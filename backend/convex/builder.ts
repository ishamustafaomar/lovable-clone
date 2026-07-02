"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { Daytona, type Sandbox } from "@daytona/sdk";

const MODEL = "claude-opus-4-8";
const SITE_DIR = "/home/daytona/site";
const PORT = 3000;
/** Minutes of inactivity before Daytona parks the sandbox (frees quota; woken via /wake). */
const AUTO_STOP_MINUTES = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedFile {
  path: string;
  content: string;
}

interface GeneratedApp {
  appName: string;
  icon: string;
  summary: string;
  files: GeneratedFile[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const build = internalAction({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(),
    isFirstBuild: v.boolean(),
  },
  handler: async (ctx, args) => {
    const setStatus = async (
      status: "generating" | "deploying" | "ready" | "error",
      statusMessage: string,
    ) => {
      await ctx.runMutation(internal.projects.update, {
        projectId: args.projectId,
        status,
        statusMessage,
      });
    };

    try {
      const project = await ctx.runQuery(internal.projects.get, {
        projectId: args.projectId,
      });
      if (!project) return; // deleted while queued

      await setStatus("generating", "Claude is writing your app…");

      const existingFiles = await ctx.runQuery(internal.files.byProject, {
        projectId: args.projectId,
      });
      const history = await ctx.runQuery(internal.messages.byProject, {
        projectId: args.projectId,
      });

      const app = await generateApp({
        request: args.prompt,
        history,
        existingFiles,
        isFirstBuild: args.isFirstBuild,
      });

      await ctx.runMutation(internal.files.replaceAll, {
        projectId: args.projectId,
        files: app.files,
      });
      if (args.isFirstBuild) {
        await ctx.runMutation(internal.projects.update, {
          projectId: args.projectId,
          name: project.name === "New App" ? app.appName : project.name,
          icon: app.icon,
        });
      }

      await setStatus("deploying", "Uploading to your cloud sandbox…");

      const deployed = await deployToSandbox(project.sandboxId, app.files);

      await ctx.runMutation(internal.projects.update, {
        projectId: args.projectId,
        status: "ready",
        statusMessage: "Live",
        sandboxId: deployed.sandboxId,
        previewUrl: deployed.previewUrl,
      });
      await ctx.runMutation(internal.messages.add, {
        projectId: args.projectId,
        role: "assistant",
        content: app.summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await setStatus("error", message);
      await ctx.runMutation(internal.messages.add, {
        projectId: args.projectId,
        role: "error",
        content: `Build failed: ${message}`,
      });
    }
  },
});

/** Restart a parked sandbox and make sure the static server is running. */
export const wake = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.runQuery(internal.projects.get, {
      projectId: args.projectId,
    });
    if (!project?.sandboxId) return;

    try {
      const daytona = new Daytona();
      const sandbox = await daytona.get(project.sandboxId);
      await sandbox.refreshData();
      if (sandbox.state !== "started") {
        await sandbox.start(120);
      }
      await ensureServerRunning(sandbox);
      const preview = await sandbox.getPreviewLink(PORT);
      await ctx.runMutation(internal.projects.update, {
        projectId: args.projectId,
        status: "ready",
        statusMessage: "Live",
        previewUrl: preview.url,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.projects.update, {
        projectId: args.projectId,
        status: "error",
        statusMessage: `Could not wake sandbox: ${message}`,
      });
    }
  },
});

export const destroySandbox = internalAction({
  args: { sandboxId: v.string() },
  handler: async (_ctx, args) => {
    try {
      const daytona = new Daytona();
      const sandbox = await daytona.get(args.sandboxId);
      await sandbox.delete(60);
    } catch {
      // Sandbox already gone — nothing to clean up.
    }
  },
});

// ---------------------------------------------------------------------------
// Code generation (Claude)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Forge, an expert web developer who builds complete, polished web apps from natural-language descriptions.

Rules:
- Build a fully self-contained STATIC web app: an index.html entry point plus optional styles.css, app.js, and other files. Reference files with relative paths.
- No build step, no npm, no server-side code — files are served as-is by a static file server.
- Well-known libraries from public CDNs are allowed (Tailwind via https://cdn.tailwindcss.com, Chart.js, Alpine.js, Google Fonts, etc.).
- The app is viewed primarily inside an iPhone WebView: design mobile-first and responsive, include <meta name="viewport" content="width=device-width, initial-scale=1">, use comfortable touch targets, and avoid hover-only interactions.
- Persist user data with localStorage where it makes sense.
- Free, keyless public APIs are allowed (e.g. Open-Meteo). Never require API keys, accounts, or signups.
- Visual polish matters: thoughtful typography, spacing, color palette, empty states, and tasteful animations. Avoid generic AI-slop aesthetics.
- ALWAYS return the COMPLETE file set for the app — every file with full contents, including files that did not change. Whatever you return fully replaces the previous files.
- Keep the app focused; total output should stay under roughly 2500 lines.

Return JSON with:
- appName: a short catchy name (1-3 words)
- icon: exactly one emoji that fits the app
- summary: 2-3 friendly sentences to the user describing what you built or changed
- files: the complete array of {path, content}`;

const APP_SCHEMA = {
  type: "object",
  properties: {
    appName: { type: "string" },
    icon: { type: "string" },
    summary: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["appName", "icon", "summary", "files"],
  additionalProperties: false,
} as const;

async function generateApp(input: {
  request: string;
  history: { role: string; content: string }[];
  existingFiles: GeneratedFile[];
  isFirstBuild: boolean;
}): Promise<GeneratedApp> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set on the Convex deployment");
  }
  const anthropic = new Anthropic({ apiKey });

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: APP_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Claude declined to build this app — try rephrasing your request.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The app got too large to generate in one pass — try a simpler request.");
  }

  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Model returned no content.");
  }

  const app = JSON.parse(text.text) as GeneratedApp;
  app.files = sanitizeFiles(app.files);
  if (!app.files.some((file) => file.path === "index.html")) {
    throw new Error("Generated app is missing index.html.");
  }
  app.icon = [...(app.icon ?? "🛠️")][0] ?? "🛠️";
  app.appName = (app.appName || "New App").slice(0, 40);
  return app;
}

function buildUserMessage(input: {
  request: string;
  history: { role: string; content: string }[];
  existingFiles: GeneratedFile[];
  isFirstBuild: boolean;
}): string {
  if (input.isFirstBuild || input.existingFiles.length === 0) {
    return `Build this web app:\n\n${input.request}`;
  }

  const conversation = input.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => `${m.role === "user" ? "User" : "You"}: ${m.content}`)
    .join("\n");

  const filesBlock = input.existingFiles
    .map((file) => `===== ${file.path} =====\n${file.content}`)
    .join("\n\n");

  return [
    "You previously built this app. Here is the conversation so far:",
    conversation,
    "Current files:",
    filesBlock,
    "Apply this change request and return the COMPLETE updated file set:",
    input.request,
  ].join("\n\n");
}

function sanitizeFiles(files: GeneratedFile[]): GeneratedFile[] {
  const clean: GeneratedFile[] = [];
  const seen = new Set<string>();
  for (const file of files ?? []) {
    if (!file?.path || typeof file.content !== "string") continue;
    const path = file.path.replace(/^\/+/, "").trim();
    if (!path || path.includes("..") || path.length > 200) continue;
    // Paths end up in shell commands — allow only a conservative charset.
    if (!/^[A-Za-z0-9._/-]+$/.test(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    clean.push({ path, content: file.content });
  }
  if (clean.length === 0) {
    throw new Error("Model returned no usable files.");
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Deployment (Daytona)
// ---------------------------------------------------------------------------

async function deployToSandbox(
  existingSandboxId: string | undefined,
  files: GeneratedFile[],
): Promise<{ sandboxId: string; previewUrl: string }> {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY is not set on the Convex deployment");
  }
  const daytona = new Daytona();

  let sandbox: Sandbox | undefined;
  if (existingSandboxId) {
    try {
      sandbox = await daytona.get(existingSandboxId);
      await sandbox.refreshData();
      if (sandbox.state !== "started") {
        await sandbox.start(120);
      }
    } catch {
      sandbox = undefined; // stale id — create a fresh sandbox below
    }
  }
  if (!sandbox) {
    sandbox = await daytona.create(
      {
        public: true,
        autoStopInterval: AUTO_STOP_MINUTES,
        labels: { app: "forge" },
      },
      { timeout: 180 },
    );
  }

  // Wipe the old site and recreate the directory tree in one shell call.
  const dirs = new Set<string>([SITE_DIR]);
  for (const file of files) {
    const slash = file.path.lastIndexOf("/");
    if (slash > 0) dirs.add(`${SITE_DIR}/${file.path.slice(0, slash)}`);
  }
  const mkdirs = [...dirs].map((d) => `'${d}'`).join(" ");
  await sandbox.process.executeCommand(
    `rm -rf '${SITE_DIR}' && mkdir -p ${mkdirs}`,
    undefined,
    undefined,
    60,
  );

  await sandbox.fs.uploadFiles(
    files.map((file) => ({
      source: Buffer.from(file.content, "utf8"),
      destination: `${SITE_DIR}/${file.path}`,
    })),
  );

  await restartServer(sandbox);

  const preview = await sandbox.getPreviewLink(PORT);
  return { sandboxId: sandbox.id, previewUrl: preview.url };
}

async function restartServer(sandbox: Sandbox): Promise<void> {
  await sandbox.process.executeCommand(
    "pkill -f 'http.server' || true",
    undefined,
    undefined,
    30,
  );
  const sessionId = `web-${Date.now()}`;
  await sandbox.process.createSession(sessionId);
  await sandbox.process.executeSessionCommand(sessionId, {
    command: `cd '${SITE_DIR}' && python3 -m http.server ${PORT} --bind 0.0.0.0`,
    runAsync: true,
  });
}

async function ensureServerRunning(sandbox: Sandbox): Promise<void> {
  const check = await sandbox.process.executeCommand(
    "pgrep -f 'http.server' >/dev/null && echo running || echo stopped",
    undefined,
    undefined,
    30,
  );
  if (!check.result?.includes("running")) {
    await restartServer(sandbox);
  }
}

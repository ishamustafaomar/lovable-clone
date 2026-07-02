import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const notFound = () => json({ error: "Project not found" }, 404);

http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => json({ ok: true })),
});

http.route({
  path: "/api/projects",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const projects = await ctx.runQuery(internal.projects.list, {});
    return json({ projects });
  }),
});

http.route({
  path: "/api/projects",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!prompt) return json({ error: "Missing 'prompt' in request body" }, 400);

    const projectId = await ctx.runMutation(internal.projects.create, {
      name,
      prompt,
    });
    await ctx.scheduler.runAfter(0, internal.builder.build, {
      projectId,
      prompt,
      isFirstBuild: true,
    });
    return json({ projectId });
  }),
});

// /api/projects/:id and /api/projects/:id/files
http.route({
  pathPrefix: "/api/projects/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const rawId = segments[2];
    const sub = segments[3];
    if (!rawId) return notFound();

    if (sub === "files") {
      const files = await ctx.runQuery(internal.files.listForApi, {
        projectId: rawId,
      });
      return files ? json({ files }) : notFound();
    }

    if (!sub) {
      const detail = await ctx.runQuery(internal.projects.detail, {
        projectId: rawId,
      });
      return detail ? json(detail) : notFound();
    }

    return notFound();
  }),
});

// /api/projects/:id/messages and /api/projects/:id/wake
http.route({
  pathPrefix: "/api/projects/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const rawId = segments[2];
    const sub = segments[3];
    if (!rawId) return notFound();

    const projectId = await ctx.runQuery(internal.projects.resolveId, {
      projectId: rawId,
    });
    if (!projectId) return notFound();

    if (sub === "messages") {
      const body = await request.json().catch(() => null);
      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) return json({ error: "Missing 'prompt' in request body" }, 400);

      const project = await ctx.runQuery(internal.projects.get, { projectId });
      if (project?.status === "generating" || project?.status === "deploying") {
        return json({ error: "A build is already in progress" }, 409);
      }

      await ctx.runMutation(internal.messages.add, {
        projectId,
        role: "user",
        content: prompt,
      });
      await ctx.scheduler.runAfter(0, internal.builder.build, {
        projectId,
        prompt,
        isFirstBuild: false,
      });
      return json({ ok: true });
    }

    if (sub === "wake") {
      await ctx.scheduler.runAfter(0, internal.builder.wake, { projectId });
      return json({ ok: true });
    }

    return notFound();
  }),
});

// DELETE /api/projects/:id
http.route({
  pathPrefix: "/api/projects/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const rawId = segments[2];
    if (!rawId || segments[3]) return notFound();

    const projectId = await ctx.runQuery(internal.projects.resolveId, {
      projectId: rawId,
    });
    if (!projectId) return notFound();

    const project = await ctx.runQuery(internal.projects.get, { projectId });
    if (project?.sandboxId) {
      await ctx.scheduler.runAfter(0, internal.builder.destroySandbox, {
        sandboxId: project.sandboxId,
      });
    }
    await ctx.runMutation(internal.projects.destroyData, { projectId });
    return json({ ok: true });
  }),
});

export default http;

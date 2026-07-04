import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { projectStatus } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";

function toApiProject(project: Doc<"projects">) {
  return {
    id: project._id,
    name: project.name,
    icon: project.icon,
    status: project.status,
    statusMessage: project.statusMessage ?? null,
    previewUrl: project.previewUrl ?? null,
    createdAt: project._creationTime,
    updatedAt: project.updatedAt,
  };
}

export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    return projects.map(toApiProject);
  },
});

export const detail = internalQuery({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("projects", args.projectId);
    if (!id) return null;
    const project = await ctx.db.get(id);
    if (!project) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();

    return {
      project: toApiProject(project),
      messages: messages.map((message) => ({
        id: message._id,
        role: message.role,
        content: message.content,
        createdAt: message._creationTime,
      })),
    };
  },
});

export const get = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const resolveId = internalQuery({
  args: { projectId: v.string() },
  handler: async (ctx, args): Promise<Id<"projects"> | null> => {
    const id = ctx.db.normalizeId("projects", args.projectId);
    if (!id) return null;
    const project = await ctx.db.get(id);
    return project ? id : null;
  },
});

export const create = internalMutation({
  args: { name: v.string(), prompt: v.string() },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      name: args.name || "New App",
      icon: "🛠️",
      initialPrompt: args.prompt,
      status: "generating",
      statusMessage: "Queued for generation…",
      updatedAt: Date.now(),
    });
    await ctx.db.insert("messages", {
      projectId,
      role: "user",
      content: args.prompt,
    });
    return projectId;
  },
});

export const update = internalMutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    status: v.optional(projectStatus),
    statusMessage: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...fields } = args;
    // Tolerate the project having been deleted mid-build.
    if (!(await ctx.db.get(projectId))) return;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(projectId, patch);
  },
});

/** How long a build may sit in generating/deploying before we assume the action died. */
const BUILD_STALE_MS = 15 * 60 * 1000;

/**
 * Atomic check-and-set guard for starting a build: rejects when a (fresh)
 * build is already running, otherwise flips the project to `generating` and
 * records the user's prompt — all in one transaction, so two rapid requests
 * can't both start builds.
 */
export const tryStartBuild = internalMutation({
  args: { projectId: v.id("projects"), prompt: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return "not_found";
    const busy =
      (project.status === "generating" || project.status === "deploying") &&
      Date.now() - project.updatedAt < BUILD_STALE_MS;
    if (busy) return "busy";
    await ctx.db.patch(args.projectId, {
      status: "generating",
      statusMessage: "Queued for generation…",
      updatedAt: Date.now(),
    });
    await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "user",
      content: args.prompt,
    });
    return "started";
  },
});

export const destroyData = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const file of files) {
      await ctx.db.delete(file._id);
    }
    await ctx.db.delete(args.projectId);
  },
});

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const byProject = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    files.sort((a, b) => a.path.localeCompare(b.path));
    return files.map((file) => ({ path: file.path, content: file.content }));
  },
});

export const listForApi = internalQuery({
  args: { projectId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("projects", args.projectId);
    if (!id) return null;
    const project = await ctx.db.get(id);
    if (!project) return null;
    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();
    files.sort((a, b) => a.path.localeCompare(b.path));
    return files.map((file) => ({ path: file.path, content: file.content }));
  },
});

/** Replace the project's entire file set with a freshly generated one. */
export const replaceAll = internalMutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(v.object({ path: v.string(), content: v.string() })),
  },
  handler: async (ctx, args) => {
    // Tolerate the project having been deleted mid-build — don't insert
    // orphaned rows.
    if (!(await ctx.db.get(args.projectId))) return;
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const file of existing) {
      await ctx.db.delete(file._id);
    }
    for (const file of args.files) {
      await ctx.db.insert("files", {
        projectId: args.projectId,
        path: file.path,
        content: file.content,
      });
    }
  },
});

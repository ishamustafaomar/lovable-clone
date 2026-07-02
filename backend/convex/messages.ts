import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const add = internalMutation({
  args: {
    projectId: v.id("projects"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("status"),
      v.literal("error"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: args.role,
      content: args.content,
    });
  },
});

export const byProject = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  },
});

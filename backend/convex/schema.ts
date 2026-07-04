import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const projectStatus = v.union(
  v.literal("idle"),
  v.literal("generating"),
  v.literal("deploying"),
  v.literal("ready"),
  v.literal("error"),
);

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    icon: v.string(),
    initialPrompt: v.string(),
    status: projectStatus,
    statusMessage: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    previewUrl: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  messages: defineTable({
    projectId: v.id("projects"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("status"),
      v.literal("error"),
    ),
    content: v.string(),
  }).index("by_project", ["projectId"]),

  files: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
  }).index("by_project", ["projectId"]),
});

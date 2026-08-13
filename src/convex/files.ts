import { mutation } from "./_generated/server";
import { v } from "convex/values";

/** Returns a short-lived upload URL for use with `useUploadFile`. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Best-effort deletion of stored files (used when a model/capture is removed). */
export const removeFiles = mutation({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    for (const id of args.storageIds) {
      await ctx.storage.delete(id);
    }
  },
});

import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal helpers for the photogrammetry action. These run in the standard
 * Convex runtime (not Node), so they can be called from `ctx.runQuery` /
 * `ctx.runMutation` inside the Node action.
 */

export const getCapture = internalQuery({
  args: { captureId: v.id("captures") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(args.captureId);
    if (doc === null || doc.userId !== userId) return null;
    return {
      name: doc.name,
      photoStorageIds: doc.photoStorageIds,
    };
  },
});

export const complete = internalMutation({
  args: {
    captureId: v.id("captures"),
    name: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const capture = await ctx.db.get(args.captureId);
    if (capture === null || capture.userId !== userId) {
      throw new Error("Capture not found");
    }

    const modelId = await ctx.db.insert("models", {
      userId,
      name: args.name,
      storageId: args.storageId,
      format: "glb",
      source: "capture",
      status: "ready",
      captureId: args.captureId,
      ...(args.thumbnailStorageId !== undefined
        ? { thumbnailStorageId: args.thumbnailStorageId }
        : {}),
    });

    await ctx.db.patch(args.captureId, {
      status: "ready",
      modelId,
    });

    return modelId;
  },
});

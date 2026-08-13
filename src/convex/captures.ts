import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("captures")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { captureId: v.id("captures") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(args.captureId);
    if (doc === null || doc.userId !== userId) return null;
    const photoUrls = await Promise.all(
      doc.photoStorageIds.map((id) => ctx.storage.getUrl(id)),
    );
    return { ...doc, photoUrls };
  },
});

export const create = mutation({
  args: { name: v.string(), photoStorageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db.insert("captures", {
      userId,
      name: args.name,
      status: "collecting",
      photoStorageIds: args.photoStorageIds,
    });
  },
});

export const setStatus = mutation({
  args: {
    captureId: v.id("captures"),
    status: v.union(
      v.literal("collecting"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    modelId: v.optional(v.id("models")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.captureId);
    if (doc === null || doc.userId !== userId) throw new Error("Not found");
    const { captureId, ...patch } = args;
    await ctx.db.patch(captureId, patch);
    return await ctx.db.get(captureId);
  },
});

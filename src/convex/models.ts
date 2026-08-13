import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

export type ModelDoc = {
  _id: import("./_generated/dataModel").Id<"models">;
  _creationTime: number;
  userId: import("./_generated/dataModel").Id<"users">;
  name: string;
  storageId: import("./_generated/dataModel").Id<"_storage">;
  format: "glb" | "gltf" | "obj" | "stl" | "ply";
  source: "import" | "capture";
  status: "processing" | "ready" | "failed";
  thumbnailStorageId?: import("./_generated/dataModel").Id<"_storage">;
  vertexCount?: number;
  triangleCount?: number;
  captureId?: import("./_generated/dataModel").Id<"captures">;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
};

async function withUrls(
  ctx: QueryCtx,
  doc: Record<string, unknown> & { storageId: string; thumbnailStorageId?: string },
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...doc };
  out.fileUrl = await ctx.storage.getUrl(doc.storageId as never);
  out.thumbnailUrl = doc.thumbnailStorageId
    ? await ctx.storage.getUrl(doc.thumbnailStorageId as never)
    : null;
  return out;
}

export const list = query({
  args: {},
  handler: async (ctx): Promise<ModelDoc[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const docs = await ctx.db
      .query("models")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return (await Promise.all(
      docs.map((d) => withUrls(ctx, d as never)),
    )) as ModelDoc[];
  },
});

export const get = query({
  args: { modelId: v.id("models") },
  handler: async (ctx, args): Promise<ModelDoc | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const doc = await ctx.db.get(args.modelId);
    if (doc === null || doc.userId !== userId) return null;
    return (await withUrls(ctx, doc as never)) as ModelDoc;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    storageId: v.id("_storage"),
    format: v.union(
      v.literal("glb"),
      v.literal("gltf"),
      v.literal("obj"),
      v.literal("stl"),
      v.literal("ply"),
    ),
    source: v.union(v.literal("import"), v.literal("capture")),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    vertexCount: v.optional(v.number()),
    triangleCount: v.optional(v.number()),
    captureId: v.optional(v.id("captures")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.db.insert("models", { ...args, userId });
  },
});

export const update = mutation({
  args: {
    modelId: v.id("models"),
    name: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    thumbnailStorageId: v.optional(v.id("_storage")),
    format: v.optional(
      v.union(
        v.literal("glb"),
        v.literal("gltf"),
        v.literal("obj"),
        v.literal("stl"),
        v.literal("ply"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("processing"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    ),
    vertexCount: v.optional(v.number()),
    triangleCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.modelId);
    if (doc === null || doc.userId !== userId) throw new Error("Not found");
    const { modelId, ...patch } = args;
    await ctx.db.patch(modelId, patch);
    return await ctx.db.get(modelId);
  },
});

export const remove = mutation({
  args: { modelId: v.id("models") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const doc = await ctx.db.get(args.modelId);
    if (doc === null || doc.userId !== userId) throw new Error("Not found");
    const toDelete: string[] = [doc.storageId];
    if (doc.thumbnailStorageId) toDelete.push(doc.thumbnailStorageId);
    await ctx.db.delete(args.modelId);
    for (const id of toDelete) {
      await ctx.storage.delete(id as never);
    }
  },
});

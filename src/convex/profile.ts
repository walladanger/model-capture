import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    preferences: v.optional(
      v.object({
        defaultExportFormat: v.optional(
          v.union(
            v.literal("glb"),
            v.literal("gltf"),
            v.literal("obj"),
            v.literal("stl"),
            v.literal("ply"),
          ),
        ),
        units: v.optional(v.union(v.literal("m"), v.literal("cm"), v.literal("mm"))),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.preferences !== undefined) patch.preferences = args.preferences;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }
    return await ctx.db.get(userId);
  },
});

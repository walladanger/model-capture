import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const modelFormatValidator = v.union(
  v.literal("glb"),
  v.literal("gltf"),
  v.literal("obj"),
  v.literal("stl"),
  v.literal("ply"),
);
export type ModelFormat = Infer<typeof modelFormatValidator>;

export const modelSourceValidator = v.union(
  v.literal("import"),
  v.literal("capture"),
);
export type ModelSource = Infer<typeof modelSourceValidator>;

export const modelStatusValidator = v.union(
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed"),
);
export type ModelStatus = Infer<typeof modelStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // product-specific profile fields
      preferences: v.optional(
        v.object({
          defaultExportFormat: v.optional(modelFormatValidator),
          units: v.optional(v.union(v.literal("m"), v.literal("cm"), v.literal("mm"))),
        }),
      ),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // a 3D model owned by a user
    models: defineTable({
      userId: v.id("users"),
      name: v.string(),
      storageId: v.id("_storage"),
      format: modelFormatValidator,
      source: modelSourceValidator,
      status: modelStatusValidator,
      thumbnailStorageId: v.optional(v.id("_storage")),
      vertexCount: v.optional(v.number()),
      triangleCount: v.optional(v.number()),
      captureId: v.optional(v.id("captures")),
    })
      .index("by_user", ["userId"])
      .index("by_capture", ["captureId"]),

    // a capture session: a set of photos used to reconstruct a model
    captures: defineTable({
      userId: v.id("users"),
      name: v.string(),
      status: v.union(
        v.literal("collecting"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("failed"),
      ),
      photoStorageIds: v.array(v.id("_storage")),
      modelId: v.optional(v.id("models")),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

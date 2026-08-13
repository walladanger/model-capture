"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const TRIPO_BASE = "https://api.tripo3d.ai/v2/openapi";
const NOT_CONFIGURED = "RECONSTRUCTION_NOT_CONFIGURED";

interface TripoFileInput {
  type: string;
  file_token: string;
}

interface TripoOutput {
  model?: string;
  base_model?: string;
  pbr_model?: string;
  rendered_image?: string;
}

function apiKey(): string {
  const key = process.env.TRIPO_API_KEY;
  if (!key) throw new Error(NOT_CONFIGURED);
  return key;
}

function fileKind(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

async function uploadPhoto(key: string, blob: Blob): Promise<TripoFileInput> {
  const kind = fileKind(blob);
  const form = new FormData();
  form.append("file", blob, `photo.${kind}`);

  const res = await fetch(`${TRIPO_BASE}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: { image_token?: string };
  };

  if (json.code !== 0 || !json.data?.image_token) {
    throw new Error(
      `Tripo upload failed (${json.message ?? json.code ?? res.status})`,
    );
  }
  return { type: kind, file_token: json.data.image_token };
}

async function createTask(
  key: string,
  files: TripoFileInput[],
): Promise<string> {
  const res = await fetch(`${TRIPO_BASE}/task`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "multiview_to_model",
      files,
      texture: true,
      pbr: true,
      auto_size: true,
    }),
  });
  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: { task_id?: string };
  };

  if (json.code !== 0 || !json.data?.task_id) {
    throw new Error(
      `Tripo task failed to start (${json.message ?? json.code ?? res.status})`,
    );
  }
  return json.data.task_id;
}

async function pollTask(
  key: string,
  taskId: string,
  timeoutMs: number,
): Promise<TripoOutput> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${TRIPO_BASE}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { status?: string; output?: TripoOutput };
    };

    const data = json.data;
    if (json.code !== 0 || !data) {
      throw new Error(
        `Tripo status failed (${json.message ?? json.code ?? res.status})`,
      );
    }
    if (data.status === "success") return data.output ?? {};
    if (
      data.status === "failed" ||
      data.status === "cancelled" ||
      data.status === "banned" ||
      data.status === "expired"
    ) {
      throw new Error(`Tripo reconstruction failed (${data.status})`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Tripo reconstruction timed out");
}

/**
 * Reconstructs a capture's photos into a GLB model via Tripo's
 * multiview-to-model pipeline, stores the result, and links it to the capture.
 *
 * Falls back to `RECONSTRUCTION_NOT_CONFIGURED` when `TRIPO_API_KEY` is absent
 * so the client can offer a demo model instead.
 */
export const fromCapture = action({
  args: { captureId: v.id("captures") },
  handler: async (ctx, args): Promise<{ modelId: string }> => {
    const key = apiKey();

    const capture = await ctx.runQuery(internal.reconstructHelpers.getCapture, {
      captureId: args.captureId,
    });
    if (capture === null) throw new Error("Capture not found");

    const files: TripoFileInput[] = [];
    for (const storageId of capture.photoStorageIds) {
      const blob = await ctx.storage.get(storageId);
      if (!blob) continue;
      files.push(await uploadPhoto(key, blob));
    }
    if (files.length < 3) throw new Error("At least 3 photos are required");

    const taskId = await createTask(key, files);
    const output = await pollTask(key, taskId, 4 * 60 * 1000);

    const modelUrl = output.model ?? output.pbr_model ?? output.base_model;
    if (!modelUrl) throw new Error("Tripo returned no model file");

    const modelRes = await fetch(modelUrl);
    if (!modelRes.ok) {
      throw new Error(`Failed to download model (${modelRes.status})`);
    }
    const storageId = await ctx.storage.store(await modelRes.blob());

    let thumbnailStorageId: Id<"_storage"> | undefined;
    if (output.rendered_image) {
      try {
        const imgRes = await fetch(output.rendered_image);
        if (imgRes.ok) {
          thumbnailStorageId = await ctx.storage.store(await imgRes.blob());
        }
      } catch {
        // Thumbnail is best-effort only.
      }
    }

    const modelId = await ctx.runMutation(internal.reconstructHelpers.complete, {
      captureId: args.captureId,
      name: capture.name,
      storageId,
      ...(thumbnailStorageId !== undefined ? { thumbnailStorageId } : {}),
    });

    return { modelId };
  },
});

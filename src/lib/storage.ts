/** Uploads a File to Convex storage and returns its Id<"_storage">. */
export async function uploadToStorage(
  generateUploadUrl: (args: Record<string, never>) => Promise<string>,
  file: File,
): Promise<string> {
  const url = await generateUploadUrl({});
  const res = await fetch(url, {
    method: "POST",
    body: file,
    headers: file.type ? { "Content-Type": file.type } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  const json = (await res.json()) as { storageId: string };
  return json.storageId;
}

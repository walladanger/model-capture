import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { uploadToStorage } from "../src/lib/storage";

describe("uploadToStorage", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(() => {
    fetchMock = mock();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchMock.mockRestore();
  });

  test("generates url, calls fetch with POST and body, returns storageId on success", async () => {
    const generateUploadUrlMock = mock().mockResolvedValue("https://upload.url");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "test-storage-id" }),
    });

    const file = new File(["test"], "test.txt", { type: "text/plain" });

    const result = await uploadToStorage(generateUploadUrlMock, file);

    expect(generateUploadUrlMock).toHaveBeenCalledTimes(1);
    expect(generateUploadUrlMock).toHaveBeenCalledWith({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://upload.url", {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    });

    expect(result).toBe("test-storage-id");
  });

  test("sets Content-Type when file has type, undefined when file has no type", async () => {
    const generateUploadUrlMock = mock().mockResolvedValue("https://upload.url");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "id" }),
    });

    // Test with type
    const fileWithType = new File(["test"], "test.txt", { type: "text/plain" });
    await uploadToStorage(generateUploadUrlMock, fileWithType);
    expect(fetchMock).toHaveBeenLastCalledWith("https://upload.url", {
      method: "POST",
      body: fileWithType,
      headers: { "Content-Type": fileWithType.type },
    });

    // Test without type
    const fileWithoutType = new File(["test"], "test", { type: "" });
    await uploadToStorage(generateUploadUrlMock, fileWithoutType);
    expect(fetchMock).toHaveBeenLastCalledWith("https://upload.url", {
      method: "POST",
      body: fileWithoutType,
      headers: undefined,
    });
  });

  test("throws 'Upload failed (500)' on res.ok false, does not call res.json", async () => {
    const generateUploadUrlMock = mock().mockResolvedValue("https://upload.url");
    const jsonMock = mock().mockResolvedValue({});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: jsonMock,
    });

    const file = new File(["test"], "test.txt");

    await expect(uploadToStorage(generateUploadUrlMock, file)).rejects.toThrow("Upload failed (500)");

    expect(jsonMock).not.toHaveBeenCalled();
  });

  test("propagates rejection from generateUploadUrl without calling fetch", async () => {
    const generateUploadUrlMock = mock().mockRejectedValue(new Error("Generate URL failed"));
    const file = new File(["test"], "test.txt");

    await expect(uploadToStorage(generateUploadUrlMock, file)).rejects.toThrow("Generate URL failed");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

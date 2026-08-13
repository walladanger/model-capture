import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { buildDemoModel, computeStats, exportModel } from "@/lib/model-io";
import { uploadToStorage } from "@/lib/storage";
import { ModelViewer } from "@/components/viewer/ModelViewer";

export default function Capture() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [step, setStep] = useState<"photos" | "processing" | "result">("photos");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createCapture = useMutation(api.captures.create);
  const setCaptureStatus = useMutation(api.captures.setStatus);
  const createModel = useMutation(api.models.create);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: { file: File; url: string }[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...next]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  const canReconstruct = photos.length >= 3 && name.trim().length > 0;

  async function handleReconstruct() {
    setStep("processing");
    try {
      const storageIds: string[] = [];
      for (const p of photos) {
        storageIds.push(await uploadToStorage(generateUploadUrl, p.file));
      }
      const captureId = await createCapture({
        name: name.trim(),
        photoStorageIds: storageIds as never,
      });
      setCaptureId(captureId);

      // Simulated reconstruction window (real photogrammetry provider plugs in here).
      await new Promise((r) => setTimeout(r, 2400));

      const demo = buildDemoModel();
      const { blob } = await exportModel(demo, "glb", "reconstruction");
      setPreviewUrl(URL.createObjectURL(blob));
      setStep("result");
    } catch (err) {
      console.error(err);
      toast.error("Reconstruction failed. Please try again.");
      setStep("photos");
    }
  }

  async function handleSave() {
    if (!previewUrl) return;
    setSaving(true);
    try {
      // Re-export the demo object as a real GLB and persist it.
      const demo = buildDemoModel();
      const stats = computeStats(demo);
      const { blob } = await exportModel(demo, "glb", name.trim() || "Scan");
      const file = new File([blob], `${name.trim() || "scan"}.glb`, {
        type: "model/gltf-binary",
      });
      const storageId = await uploadToStorage(generateUploadUrl, file);
      const modelId = await createModel({
        name: name.trim() || "Untitled scan",
        storageId: storageId as never,
        format: "glb",
        source: "capture",
        status: "ready",
        vertexCount: stats.vertices,
        triangleCount: stats.triangles,
        ...(captureId ? { captureId: captureId as never } : {}),
      });
      if (captureId) {
        await setCaptureStatus({
          captureId: captureId as never,
          status: "ready",
          modelId: modelId as never,
        });
      }
      toast.success("Scan saved to your library");
      navigate(`/app/models/${modelId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save scan");
      setSaving(false);
    }
  }

  if (step === "processing") {
    return (
      <div className="flex h-full min-h-screen flex-col items-center justify-center px-8">
        <div className="flex size-12 items-center justify-center rounded-full border border-border">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <p className="mt-5 text-sm font-medium">Reconstructing your object…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aligning {photos.length} photos and building the mesh.
        </p>
      </div>
    );
  }

  if (step === "result") {
    return (
      <div className="flex h-screen flex-col">
        <div className="flex items-center justify-between border-b border-border px-8 py-4">
          <Button variant="ghost" className="gap-2" onClick={() => navigate("/app")}>
            <ArrowLeft className="size-4" />
            Discard
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium">{name.trim() || "Untitled scan"}</p>
            <p className="text-xs text-muted-foreground">Ready to review</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            Save to library
          </Button>
        </div>

        <div className="relative flex-1">
          {previewUrl && (
            <ModelViewer
              url={previewUrl}
              format="glb"
              mode="orbit"
              brushSize={0.08}
              transform={{ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }}
              wireframe={false}
              color={null}
            />
          )}
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            Demo reconstruction — connect a photogrammetry provider for production-quality
            results. Import a real model or edit this one below.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <button
        onClick={() => navigate("/app/new")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Scan from photos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Take 8–40 photos, circling the object with plenty of overlap. Avoid moving parts and
          glossy reflections.
        </p>
      </header>

      <div className="mt-8 border-t border-border" />

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
        {/* Photo upload */}
        <div>
          <div
            className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-10 text-center transition-colors hover:border-foreground/30"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card">
              <Camera className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">Add photos of your object</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag &amp; drop, or click to browse. JPG / PNG / HEIC.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {photos.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((p, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-foreground/30"
              >
                <ImagePlus className="size-5" />
              </button>
            </div>
          )}
        </div>

        {/* Side panel */}
        <aside className="flex flex-col gap-5">
          <div>
            <Label htmlFor="scan-name" className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="scan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My car"
              className="mt-1.5"
            />
          </div>

          <div className="rounded-md border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">Tips</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              <li>Keep the object still; move around it.</li>
              <li>Overlap each photo by ~60%.</li>
              <li>Use even, diffuse lighting.</li>
            </ul>
          </div>

          <Button
            onClick={handleReconstruct}
            disabled={!canReconstruct}
            className="w-full gap-2"
          >
            Reconstruct
            <ArrowRight className="size-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {photos.length} photo{photos.length === 1 ? "" : "s"} added · 3 minimum
          </p>
        </aside>
      </div>
    </div>
  );
}

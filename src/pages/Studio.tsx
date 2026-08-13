import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Box,
  Check,
  Download,
  Eraser,
  Eye,
  Hand,
  Loader2,
  Maximize2,
  Move3d,
  Palette,
  RotateCcw,
  Save,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  downloadBlob,
  exportModel,
  MODEL_FORMATS,
  ModelFormat,
} from "@/lib/model-io";
import { uploadToStorage } from "@/lib/storage";
import {
  ModelViewer,
  ModelViewerHandle,
  ViewerTransform,
} from "@/components/viewer/ModelViewer";
import type { ModelStats } from "@/lib/model-io";

type Tool = "orbit" | "erase" | "transform" | "material";

const TOOLS: { id: Tool; label: string; icon: typeof Hand }[] = [
  { id: "orbit", label: "Navigate", icon: Hand },
  { id: "erase", label: "Cleanup", icon: Eraser },
  { id: "transform", label: "Transform", icon: Move3d },
  { id: "material", label: "Material", icon: Palette },
];

const SWATCHES = [
  "#f8fafc",
  "#cbd5e1",
  "#9ca3af",
  "#64748b",
  "#334155",
  "#1e293b",
  "#b91c1c",
  "#1d4ed8",
  "#15803d",
  "#a16207",
];

const DEFAULT_TRANSFORM: ViewerTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

export default function Studio() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const model = useQuery(api.models.get, modelId ? { modelId: modelId as never } : "skip");
  const updateModel = useMutation(api.models.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const viewerRef = useRef<ModelViewerHandle>(null);

  const [loadKey, setLoadKey] = useState<{ id: string; url: string; format: ModelFormat } | null>(
    null,
  );
  const [tool, setTool] = useState<Tool>("orbit");
  const [brushSize, setBrushSize] = useState(0.08);
  const [transform, setTransform] = useState<ViewerTransform>(DEFAULT_TRANSFORM);
  const [wireframe, setWireframe] = useState(false);
  const [color, setColor] = useState<string | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [eraseCount, setEraseCount] = useState(0);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingFmt, setExportingFmt] = useState<ModelFormat | null>(null);

  useEffect(() => {
    if (model && (!loadKey || loadKey.id !== model._id) && model.fileUrl) {
      setLoadKey({ id: model._id, url: model.fileUrl, format: model.format });
      setName(model.name);
      setStats(model.triangleCount ? { vertices: 0, triangles: model.triangleCount, meshes: 0 } : null);
    }
  }, [model, loadKey]);

  if (model === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (model === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Box className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Model not found.</p>
        <Button variant="outline" onClick={() => navigate("/app")}>
          Back to library
        </Button>
      </div>
    );
  }

  const mode = tool === "erase" ? "erase" : "orbit";

  async function handleSave() {
    const object = viewerRef.current?.getObject();
    if (!object) return;
    setSaving(true);
    try {
      const current = viewerRef.current!.getStats();
      const { blob } = await exportModel(object, "glb", name.trim() || model!.name);
      const file = new File([blob], `${name.trim() || "model"}.glb`, {
        type: "model/gltf-binary",
      });
      const storageId = await uploadToStorage(generateUploadUrl, file);
      await updateModel({
        modelId: model!._id as never,
        storageId: storageId as never,
        format: "glb",
        vertexCount: current?.vertices ?? 0,
        triangleCount: current?.triangles ?? 0,
        ...(name.trim() && name.trim() !== model!.name ? { name: name.trim() } : {}),
      });
      toast.success("Model saved");
    } catch (err) {
      console.error(err);
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(fmt: ModelFormat) {
    const object = viewerRef.current?.getObject();
    if (!object) return;
    setExportingFmt(fmt);
    try {
      const result = await exportModel(object, fmt, name.trim() || model!.name);
      downloadBlob(result);
      toast.success(`Exported ${MODEL_FORMATS[fmt].label}`);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExportingFmt(null);
      setExportOpen(false);
    }
  }

  async function handleRename() {
    if (!name.trim() || name.trim() === model!.name) return;
    try {
      await updateModel({ modelId: model!._id as never, name: name.trim() });
      toast.success("Renamed");
    } catch {
      toast.error("Rename failed");
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")} title="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="h-6 w-px bg-border" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="min-w-0 max-w-[260px] rounded-md bg-transparent px-2 py-1 text-sm font-medium outline-none hover:bg-secondary focus:bg-secondary"
          />
          {stats && stats.triangles > 0 && (
            <span className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
              {stats.triangles.toLocaleString()} tris
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center justify-center gap-1 border-b border-border bg-card/60 px-5 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              tool === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Viewer */}
        <div className="relative min-w-0 flex-1 bg-secondary/30">
          {loadKey && (
            <ModelViewer
              ref={viewerRef}
              url={loadKey.url}
              format={loadKey.format}
              mode={mode}
              brushSize={brushSize}
              transform={transform}
              wireframe={wireframe}
              color={color}
              onReady={({ stats: s }) => setStats(s)}
              onEraseCount={setEraseCount}
            />
          )}

          {/* overlays */}
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
            {mode === "erase" ? (
              <div className="rounded-md border border-border bg-card/90 px-3 py-2 text-xs text-foreground backdrop-blur">
                <span className="font-medium">Cleanup</span> — drag over the mesh to remove floating
                debris. <span className="text-muted-foreground">{eraseCount.toLocaleString()} tris removed</span>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
                Drag to orbit · scroll to zoom · right-drag to pan
              </div>
            )}
          </div>

          <div className="absolute right-4 top-4 flex flex-col gap-2">
            <Button
              variant="outline"
              size="icon"
              className="pointer-events-auto size-8 bg-card/80 backdrop-blur"
              onClick={() => viewerRef.current?.resetCamera()}
              title="Reset view"
            >
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Control panel */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
          {tool === "orbit" && (
            <div className="flex flex-1 flex-col gap-6 p-5">
              <div>
                <h3 className="text-sm font-medium">Navigation</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Inspect the model from any angle. Switch to the other tools to clean up or adjust
                  the model before exporting.
                </p>
              </div>
              <div className="mt-auto flex flex-col gap-3">
                <Button variant="outline" className="gap-2" onClick={() => viewerRef.current?.resetCamera()}>
                  <Eye className="size-4" /> Center model
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    setWireframe(false);
                    setColor(null);
                    setTransform(DEFAULT_TRANSFORM);
                  }}
                >
                  <RotateCcw className="size-4" /> Reset appearance
                </Button>
              </div>
            </div>
          )}

          {tool === "erase" && (
            <div className="flex flex-1 flex-col gap-6 p-5">
              <div>
                <h3 className="text-sm font-medium">Cleanup brush</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Paint over unwanted geometry to delete it. Changes are applied live and saved with
                  the model.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Brush size</Label>
                  <span className="text-xs tabular-nums">{Math.round(brushSize * 100)}%</span>
                </div>
                <Slider
                  value={[brushSize]}
                  min={0.01}
                  max={0.3}
                  step={0.005}
                  onValueChange={([v]) => setBrushSize(v)}
                />
              </div>

              <div className="mt-auto flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={eraseCount === 0}
                  onClick={() => viewerRef.current?.undoErase()}
                >
                  <Undo2 className="size-4" /> Undo stroke
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  disabled={eraseCount === 0}
                  onClick={() => viewerRef.current?.clearErase()}
                >
                  <RotateCcw className="size-4" /> Restore all
                </Button>
              </div>
            </div>
          )}

          {tool === "transform" && (
            <div className="flex flex-1 flex-col gap-5 p-5">
              <div>
                <h3 className="text-sm font-medium">Transform</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Reposition, rotate or scale the model. Adjustments are baked in on save and
                  export.
                </p>
              </div>

              <VecSlider label="X" value={transform.position[0]} min={-2} max={2} step={0.01}
                onChange={(v) => setTransform((t) => ({ ...t, position: [v, t.position[1], t.position[2]] }))} />
              <VecSlider label="Y" value={transform.position[1]} min={-2} max={2} step={0.01}
                onChange={(v) => setTransform((t) => ({ ...t, position: [t.position[0], v, t.position[2]] }))} />
              <VecSlider label="Z" value={transform.position[2]} min={-2} max={2} step={0.01}
                onChange={(v) => setTransform((t) => ({ ...t, position: [t.position[0], t.position[1], v] }))} />

              <div className="border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Rotation</Label>
                  <span className="text-xs tabular-nums">{Math.round(transform.rotation[1])}°</span>
                </div>
                <Slider
                  value={[transform.rotation[1]]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={([v]) => setTransform((t) => ({ ...t, rotation: [t.rotation[0], v, t.rotation[2]] }))}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Scale</Label>
                  <span className="text-xs tabular-nums">{transform.scale.toFixed(2)}×</span>
                </div>
                <Slider
                  value={[transform.scale]}
                  min={0.2}
                  max={3}
                  step={0.01}
                  onValueChange={([v]) => setTransform((t) => ({ ...t, scale: v }))}
                />
              </div>

              <Button
                variant="ghost"
                className="mt-auto gap-2"
                onClick={() => setTransform(DEFAULT_TRANSFORM)}
              >
                <RotateCcw className="size-4" /> Reset transform
              </Button>
            </div>
          )}

          {tool === "material" && (
            <div className="flex flex-1 flex-col gap-6 p-5">
              <div>
                <h3 className="text-sm font-medium">Material</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Tint the model or preview the wireframe topology.
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md border border-border",
                        color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {color === c && <Check className="size-3.5 text-foreground mix-blend-difference" />}
                    </button>
                  ))}
                  <label
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-foreground/30"
                    title="Custom color"
                  >
                    <input
                      type="color"
                      className="h-0 w-0 opacity-0"
                      onChange={(e) => setColor(e.target.value)}
                    />
                    +
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="wireframe" className="text-sm">Wireframe</Label>
                <Switch id="wireframe" checked={wireframe} onCheckedChange={setWireframe} />
              </div>

              <Button
                variant="ghost"
                className="mt-auto gap-2"
                onClick={() => {
                  setColor(null);
                  setWireframe(false);
                }}
              >
                <RotateCcw className="size-4" /> Reset material
              </Button>
            </div>
          )}
        </aside>
      </div>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export model</DialogTitle>
            <DialogDescription>
              Choose a format. The current edits are included.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(MODEL_FORMATS) as ModelFormat[]).map((fmt) => (
              <button
                key={fmt}
                disabled={exportingFmt !== null}
                onClick={() => handleExport(fmt)}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:border-foreground/25 hover:bg-secondary/60 disabled:opacity-60"
              >
                <div>
                  <p className="text-sm font-medium">{MODEL_FORMATS[fmt].label}</p>
                  <p className="text-xs text-muted-foreground">{MODEL_FORMATS[fmt].description}</p>
                </div>
                {exportingFmt === fmt ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Download className="size-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VecSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Position · {label}</Label>
        <span className="text-xs tabular-nums">{value.toFixed(2)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

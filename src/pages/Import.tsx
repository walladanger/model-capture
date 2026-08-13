import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, FileBox, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { detectFormat, IMPORT_ACCEPT, ModelFormat } from "@/lib/model-io";
import { uploadToStorage } from "@/lib/storage";
import { ModelViewer } from "@/components/viewer/ModelViewer";

export default function Import() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<ModelFormat | null>(null);
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createModel = useMutation(api.models.create);

  const formatLabel = useMemo(() => (format ? format.toUpperCase() : null), [format]);

  function pickFile(f: File | null) {
    if (!f) return;
    const fmt = detectFormat(f.name);
    if (!fmt) {
      toast.error("Unsupported file type. Use GLB, glTF, OBJ, STL or PLY.");
      return;
    }
    setFile(f);
    setFormat(fmt);
    setName(f.name.replace(/\.[^/.]+$/, ""));
    setUrl(URL.createObjectURL(f));
  }

  async function handleImport() {
    if (!file || !format) return;
    setImporting(true);
    try {
      const storageId = await uploadToStorage(generateUploadUrl, file);
      const modelId = await createModel({
        name: name.trim() || file.name.replace(/\.[^/.]+$/, ""),
        storageId: storageId as never,
        format,
        source: "import",
        status: "ready",
      });
      toast.success("Model imported");
      navigate(`/app/models/${modelId}`);
    } catch (err) {
      console.error(err);
      toast.error("Import failed");
      setImporting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/app/new")}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium">Import a model</p>
          <p className="text-xs text-muted-foreground">GLB · glTF · OBJ · STL · PLY</p>
        </div>
        <Button onClick={handleImport} disabled={!file || importing} className="gap-2">
          {importing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          Import
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[360px_1fr]">
        {/* Left controls */}
        <div className="flex flex-col gap-6 border-r border-border p-8">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-12 text-center transition-colors hover:border-foreground/30"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-border bg-card">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">
              {file ? file.name : "Drop a model file"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {file ? `${formatLabel} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "or click to browse"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label htmlFor="model-name" className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="model-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="mt-auto rounded-md border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <FileBox className="size-4" /> Supported formats
            </p>
            <p className="mt-1.5">
              Imported models are stored as their original file and can be exported to GLB, glTF,
              OBJ, STL or PLY after editing.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="relative min-h-0 bg-secondary/30">
          {url && format ? (
            <ModelViewer
              url={url}
              format={format}
              mode="orbit"
              brushSize={0.08}
              transform={{ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }}
              wireframe={false}
              color={null}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <FileBox className="size-10" />
              <p className="mt-3 text-sm">Preview appears here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

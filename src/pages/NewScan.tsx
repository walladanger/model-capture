import { useNavigate } from "react-router";
import { ArrowRight, Camera, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";

const OPTIONS = [
  {
    id: "capture",
    title: "Scan from photos",
    description:
      "Upload photos of an object from multiple angles and reconstruct it into a 3D model.",
    icon: Camera,
    to: "/app/capture",
  },
  {
    id: "import",
    title: "Import a model",
    description:
      "Bring in an existing GLB, glTF, OBJ, STL or PLY file to view, edit and export.",
    icon: Upload,
    to: "/app/import",
  },
];

export default function NewScan() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create a new scan</h1>
      </header>

      <div className="mt-8 border-t border-border" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <Card
            key={opt.id}
            className="group cursor-pointer border-border/80 p-6 transition-colors hover:border-foreground/25"
            onClick={() => navigate(opt.to)}
          >
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-secondary">
              <opt.icon className="size-5" />
            </div>
            <h2 className="mt-4 flex items-center gap-2 text-base font-medium">
              {opt.title}
              <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{opt.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

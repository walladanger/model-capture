import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { formatDistanceToNow } from "date-fns";
import { Box, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MODEL_FORMATS } from "@/lib/model-io";

export default function Library() {
  const models = useQuery(api.models.list);
  const removeModel = useMutation(api.models.remove);
  const navigate = useNavigate();

  const handleDelete = async (id: string, name: string) => {
    try {
      await removeModel({ modelId: id as never });
      toast.success(`Deleted "${name}"`);
    } catch {
      toast.error("Failed to delete model");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Model library</h1>
        </div>
        <Button onClick={() => navigate("/app/new")} className="gap-2">
          <Plus className="size-4" />
          New scan
        </Button>
      </header>

      <div className="mt-8 border-t border-border" />

      {models === undefined ? (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-28 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-border bg-secondary">
            <Box className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No models yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scan an object from photos or import an existing model.
            </p>
          </div>
          <Button onClick={() => navigate("/app/new")} className="gap-2">
            <Plus className="size-4" />
            Create your first scan
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => {
            const fmt = MODEL_FORMATS[model.format];
            return (
              <div
                key={model._id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/app/models/${model._id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/app/models/${model._id}`);
                }}
                className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-foreground/20"
              >
                <div className="flex h-40 items-center justify-center border-b border-border bg-gradient-to-b from-secondary/60 to-card">
                  <Box className="size-10 text-muted-foreground/50 transition-transform group-hover:scale-105" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{model.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(model._creationTime, { addSuffix: true })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span
                          role="button"
                          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-4" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(model._id, model.name)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {fmt.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {model.source === "capture" ? "Scanned" : "Imported"}
                      {model.triangleCount ? ` · ${model.triangleCount.toLocaleString()} tris` : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

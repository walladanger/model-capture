import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Check, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ModelFormat } from "@/lib/model-io";

const FORMAT_OPTIONS: { value: ModelFormat; label: string }[] = [
  { value: "glb", label: "GLB" },
  { value: "gltf", label: "glTF" },
  { value: "obj", label: "OBJ" },
  { value: "stl", label: "STL" },
  { value: "ply", label: "PLY" },
];

const UNITS_OPTIONS = [
  { value: "m", label: "Meters" },
  { value: "cm", label: "Centimeters" },
  { value: "mm", label: "Millimeters" },
];

export default function Settings() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.profile.updateProfile);

  const [name, setName] = useState(user?.name ?? "");
  const [format, setFormat] = useState<ModelFormat>(
    user?.preferences?.defaultExportFormat ?? "glb",
  );
  const [units, setUnits] = useState<"m" | "cm" | "mm">(user?.preferences?.units ?? "m");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setFormat(user.preferences?.defaultExportFormat ?? "glb");
      setUnits(user.preferences?.units ?? "m");
    }
  }, [user]);

  const initials = (name || user?.email || "?").slice(0, 2).toUpperCase();

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        preferences: { defaultExportFormat: format, units },
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile &amp; settings</h1>
      </header>

      <div className="mt-8 border-t border-border" />

      <div className="mt-8 flex flex-col gap-8">
        {/* Profile */}
        <section className="flex items-center gap-4">
          <Avatar className="size-14 rounded-md">
            <AvatarFallback className="rounded-md text-base">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground">
              Display name
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </section>

        <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
          <Mail className="size-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm">{user?.email || "Guest account (anonymous)"}</p>
          </div>
        </div>

        {/* Preferences */}
        <section>
          <h2 className="text-sm font-medium">Preferences</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Defaults applied to new exports and measurements.
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                Default export format
              </Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ModelFormat)}>
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground">Units</Label>
              <Select value={units} onValueChange={(v) => setUnits(v as "m" | "cm" | "mm")}>
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

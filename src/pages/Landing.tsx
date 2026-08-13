import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  ArrowRight,
  Box,
  Camera,
  Download,
  Eraser,
  Eye,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const FEATURES = [
  {
    icon: Camera,
    title: "Scan from photos",
    description:
      "Capture an object from multiple angles — a car, a figurine, a product — and let the pipeline align every frame into one model.",
  },
  {
    icon: Sparkles,
    title: "Right the first time",
    description:
      "A reconstruction engine tuned to get the geometry mostly correct on the first pass, so cleanup is light work, not a rescue mission.",
  },
  {
    icon: Eye,
    title: "Interactive viewer",
    description:
      "Orbit, pan and zoom a real-time, physically-lit preview. Inspect topology and surface detail before you commit.",
  },
  {
    icon: Eraser,
    title: "Cleanup tools",
    description:
      "Paint away floating debris and stray triangles with a precise brush, then undo any stroke.",
  },
  {
    icon: Download,
    title: "Export anywhere",
    description:
      "Save to GLB, glTF, OBJ, STL or PLY. Your models stay portable across web, AR, game engines and 3D printing.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    description:
      "Your scans and source photos live in your own workspace. Nothing is shared unless you choose to.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Capture",
    description: "Photograph your object from every side with overlap between shots.",
  },
  {
    n: "02",
    title: "Reconstruct",
    description: "The engine aligns the photos and generates a watertight mesh.",
  },
  {
    n: "03",
    title: "Refine & export",
    description: "Clean up, adjust, and export in the format you need.",
  },
];

const FORMATS = ["GLB", "glTF", "OBJ", "STL", "PLY"];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const appLink = isAuthenticated ? "/app" : "/auth";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <ScanLine className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Relief</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#workflow" className="transition-colors hover:text-foreground">Workflow</a>
            <a href="#formats" className="transition-colors hover:text-foreground">Formats</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to={appLink} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Button asChild size="sm" className="gap-2">
              <Link to={appLink}>
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center md:pt-32">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <Box className="size-3.5" />
              Photogrammetry for the web
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
              Turn photos into 3D models, precisely.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Shoot your car, your product, your object from any angle. Relief reconstructs it into
              a clean, editable model you can view, refine and export anywhere.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to={appLink}>
                  Start scanning
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={isAuthenticated ? "/app/import" : "/auth?returnTo=%2Fapp%2Fimport"}>
                  Import a model
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mx-auto mt-16 max-w-4xl"
          >
            <WireframeCube />
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-border md:grid-cols-4">
          {[
            ["5", "Export formats"],
            ["Real-time", "Web viewer"],
            ["Brush", "Cleanup tooling"],
            ["Private", "Per-user workspace"],
          ].map(([v, l]) => (
            <div key={l} className="px-6 py-8 text-center">
              <p className="text-2xl font-semibold tracking-tight">{v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Features"
          title="A quiet, capable studio"
          description="Everything you need to go from photos to a finished model — without the noise."
        />
        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group bg-card p-7 transition-colors hover:bg-secondary/50">
              <div className="flex size-9 items-center justify-center rounded-md border border-border bg-background">
                <f.icon className="size-4 text-muted-foreground" />
              </div>
              <h3 className="mt-5 text-sm font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading
            eyebrow="Workflow"
            title="Three steps to a finished model"
            description="Designed to get the geometry mostly right the first time, with tools to clean up the rest."
          />
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">{s.n}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Formats */}
      <section id="formats" className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Formats"
          title="Portable in every direction"
          description="Import what you have, export what you need. Models stay editable the whole way."
        />
        <div className="mt-12">
          {FORMATS.map((f) => (
            <div
              key={f}
              className="group flex items-center justify-between border-b border-border py-5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-lg font-medium tracking-tight">{f}</span>
                <span className="text-sm text-muted-foreground">
                  {f === "GLB" && "Binary glTF — web & AR"}
                  {f === "glTF" && "JSON scene graph"}
                  {f === "OBJ" && "Universal geometry"}
                  {f === "STL" && "3D printing"}
                  {f === "PLY" && "Point cloud / mesh"}
                </span>
              </div>
              <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Bring your object into 3D.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
            Create a free workspace and scan your first model in minutes.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to={appLink}>
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-foreground text-background">
              <ScanLine className="size-3" />
            </div>
            <span>Relief — 3D scanning studio</span>
          </div>
          <p>Built for the web. Your models, your workspace.</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function WireframeCube() {
  return (
    <div className="relative mx-auto flex aspect-[16/8] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-secondary/40 to-card">
      <svg
        viewBox="0 0 560 280"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9ca3af" />
            <stop offset="1" stopColor="#4b5563" />
          </linearGradient>
        </defs>
        {/* point cloud */}
        {POINTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#cbd5e1" opacity="0.7" />
        ))}
        {/* wireframe object */}
        <g stroke="url(#edge)" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M280 60 L400 120 L280 200 L160 120 Z" />
          <path d="M280 60 L280 130" />
          <path d="M160 120 L280 130 L400 120" />
          <path d="M280 130 L280 200" />
          <path d="M215 95 L245 105 L215 145 L185 135 Z" opacity="0.7" />
          <path d="M345 95 L375 105 L345 145 L315 135 Z" opacity="0.7" />
        </g>
        <circle cx="280" cy="130" r="3" fill="#1f2937" />
      </svg>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        <span className="size-1.5 rounded-full bg-foreground" />
        1,284 aligned features
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
        <span className="size-1.5 rounded-full bg-muted-foreground" />
        Live viewer
      </div>
    </div>
  );
}

const POINTS: [number, number][] = [
  [96, 74], [150, 40], [205, 66], [268, 30], [330, 52], [392, 36], [452, 70],
  [70, 120], [120, 108], [176, 132], [232, 100], [300, 92], [368, 112], [430, 104], [488, 122],
  [104, 176], [168, 200], [228, 168], [288, 204], [348, 176], [410, 204], [470, 172],
  [150, 244], [260, 240], [360, 236], [440, 244],
];

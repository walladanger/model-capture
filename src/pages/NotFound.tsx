import { motion } from "framer-motion";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-md bg-foreground text-background">
          <ScanLine className="size-5" />
        </div>
        <p className="mt-8 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <Button asChild variant="outline" className="mt-8 gap-2">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

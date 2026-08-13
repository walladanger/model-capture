import { useAuth } from "@/hooks/use-auth";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Box, LogOut, Plus, Settings, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { to: "/app", label: "Library", icon: Box, end: true },
  { to: "/app/new", label: "New scan", icon: Plus, end: false },
  { to: "/app/settings", label: "Settings", icon: Settings, end: false },
];

export default function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.name || user?.email || "?").slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
          <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
            <ScanLine className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Relief</p>
            <p className="text-[11px] text-muted-foreground">3D studio</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-8 rounded-md">
              <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user?.name || "Guest"}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.email || "Anonymous"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleSignOut}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

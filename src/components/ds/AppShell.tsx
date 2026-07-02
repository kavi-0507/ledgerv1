import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Upload,
  Sparkles,
  ClipboardCheck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PRIMARY: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/transactions", label: "Activity", icon: Receipt },
  { to: "/budgets", label: "Budgets", icon: PieChart },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/review", label: "Review", icon: ClipboardCheck },
];

const SECONDARY: NavItem[] = [
  { to: "/import", label: "Import", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
];

function useCurrentPath() {
  return useRouterState({ select: (s) => s.location.pathname });
}

function DesktopLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "interactive flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  const path = useCurrentPath();

  return (
    <div className="min-h-screen w-full">
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar/60 backdrop-blur-xl md:flex">
        <Link to="/" className="flex h-16 items-center gap-2 px-6">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="text-display text-lg italic">L</span>
          </div>
          <span className="text-display text-xl">Ledger</span>
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-2">
          <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Money
          </p>
          {PRIMARY.map((item) => (
            <DesktopLink key={item.to} item={item} active={path === item.to} />
          ))}
          <p className="px-3 pb-2 pt-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Tools
          </p>
          {SECONDARY.map((item) => (
            <DesktopLink key={item.to} item={item} active={path === item.to} />
          ))}
        </nav>

        <div className="border-t border-border p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Local backend</p>
          <p className="mt-0.5 truncate">127.0.0.1:8000/api</p>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-h-screen flex-col md:pl-64">
        {header && (
          <header className="glass sticky top-0 z-20 border-b border-border">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
              {header}
            </div>
          </header>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-safe md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = path === item.to;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-md transition-colors",
                      active && "bg-primary-soft",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

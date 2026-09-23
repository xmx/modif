import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePathname, navigate } from "@/lib/router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModifLogo } from "@/components/ModifLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WifiIcon, WifiOffIcon } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "审计对话" },
  { path: "/admin", label: "管理后台" },
];

const isActive = (pathname: string, path: string) => {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

export function AppLayout({
  connected,
  onToggleConnection,
  children,
}: {
  connected: boolean;
  onToggleConnection: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶部导航栏 */}
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <div className="flex items-center gap-2 pr-4 select-none">
          <ModifLogo className="size-5" />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-[0.95rem] font-bold tracking-[0.15em] text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
            MODIF
          </span>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              isActive(pathname, item.path)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger>
              <span
                onClick={onToggleConnection}
                className="inline-flex size-8 cursor-pointer shrink-0 items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
              >
                {connected ? (
                  <WifiIcon className="size-[1.2rem] text-emerald-500" />
                ) : (
                  <WifiOffIcon className="size-[1.2rem] text-destructive" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {connected ? "已连接 · 点击断开" : "已断开 · 点击连接"}
            </TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </header>

      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
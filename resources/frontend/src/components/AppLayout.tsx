import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePathname, navigate } from "@/lib/router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModifLogo } from "@/components/ModifLogo";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WifiIcon, WifiOffIcon, FilePenLineIcon, BellIcon, LogOutIcon } from "lucide-react";
import { expireAuth } from "@/lib/auth";

interface NavItem {
  path: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "会话审计" },
  { path: "/admin", label: "管理后台" },
];

const isActive = (pathname: string, path: string) => {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

export function AppLayout({
  connected,
  onToggleConnection,
  rewrite,
  onToggleRewrite,
  children,
}: {
  connected: boolean;
  onToggleConnection: () => void;
  rewrite: boolean | null;
  onToggleRewrite: () => void;
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
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.path);
          const toggleEnabled = item.path === "/" && active;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{item.label}</span>
              {item.path === "/" &&
                (!connected ? (
                  <Badge
                    variant="destructive"
                    title="WebSocket 已断开，无法切换模式"
                    className="h-5 px-1.5 py-0 text-[0.65rem]"
                  >
                    <WifiOffIcon />
                    离线
                  </Badge>
                ) : rewrite !== null ? (
                  <Badge
                    variant="secondary"
                    role={toggleEnabled ? "button" : undefined}
                    tabIndex={toggleEnabled ? 0 : undefined}
                    title={
                      toggleEnabled
                        ? rewrite
                          ? "当前为改写模式，点击切换为通知模式"
                          : "当前为通知模式，点击切换为改写模式"
                        : undefined
                    }
                    onClick={
                      toggleEnabled
                        ? (e) => {
                            e.stopPropagation();
                            onToggleRewrite();
                          }
                        : undefined
                    }
                    onKeyDown={
                      toggleEnabled
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onToggleRewrite();
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "h-5 px-1.5 py-0 text-[0.65rem]",
                      toggleEnabled && "cursor-pointer",
                      rewrite
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {rewrite ? <FilePenLineIcon /> : <BellIcon />}
                    {rewrite ? "改写" : "通知"}
                  </Badge>
                ) : null)}
            </button>
          );
        })}

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
          <Tooltip>
            <TooltipTrigger>
              <button
                type="button"
                onClick={expireAuth}
                aria-label="退出登录"
                className="inline-flex size-8 cursor-pointer shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOutIcon className="size-[1.1rem]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">退出登录</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
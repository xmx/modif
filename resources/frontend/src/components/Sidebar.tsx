import type { SessionData } from "@/hooks/useStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModifLogo } from "@/components/ModifLogo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { WifiIcon, WifiOffIcon, GlobeIcon } from "lucide-react";

export function Sidebar({ sessions, selectedSessionId, connected, onSelectSession, onToggleConnection }: {
  sessions: SessionData[];
  selectedSessionId: string | null;
  connected: boolean;
  onSelectSession: (id: string) => void;
  onToggleConnection: () => void;
}) {
  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ModifLogo className="size-5" />
          <span className="text-sm font-semibold tracking-wider">MODIF</span>
        </div>
        <div className="flex items-center gap-1">
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
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              等待 AI 请求...
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.sessionId}
                onClick={() => onSelectSession(session.sessionId)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer",
                  selectedSessionId === session.sessionId && "bg-accent"
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">{session.userAgent}</span>
                </div>
                <div className="flex w-full items-center gap-1.5 text-[0.65rem] text-muted-foreground">
                  <span className="truncate">{session.requests.length} 请求</span>
                  {session.requests.length > 0 && (
                    <span className="truncate opacity-70">· {session.requests[session.requests.length - 1].model}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
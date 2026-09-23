import type { SessionData } from "@/hooks/useStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NetworkIcon } from "lucide-react";

export function Sidebar({ sessions, selectedSessionId, onSelectSession }: {
  sessions: SessionData[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
}) {
  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              等待 AI 请求...
            </div>
          ) : (
            sessions.map((session) => {
              const latest = session.requests[session.requests.length - 1];
              const active = session.requests.some((req) => !req.done && !req.error);
              return (
                <button
                  key={session.sessionId}
                  onClick={() => onSelectSession(session.sessionId)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent cursor-pointer",
                    selectedSessionId === session.sessionId && "bg-accent"
                  )}
                >
                  <div className="flex w-full items-center gap-2">
                    <NetworkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-xs font-medium">
                      {session.clientIP || session.sessionId}
                    </span>
                    {active && (
                      <span
                        className="ml-auto relative flex size-2.5 shrink-0"
                        title="正在交互"
                        aria-label="正在交互"
                      >
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                      </span>
                    )}
                  </div>
                  <div className="flex w-full items-center gap-1.5">
                    <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                      {session.requests.length} 请求
                    </span>
                    {latest && (
                      <Badge variant="secondary" className="min-w-0 max-w-full truncate px-1.5 text-[0.65rem]">
                        {latest.model}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
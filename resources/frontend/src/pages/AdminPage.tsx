import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IngestUpload } from "@/components/IngestUpload";
import { DocumentList } from "@/components/DocumentList";
import { UIList } from "@/components/UIList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch, problemMessage } from "@/lib/problem";
import { useToast } from "@/components/ui/toast";
import { usePathname, navigate } from "@/lib/router";
import { CableIcon, FileUpIcon, PaletteIcon, RefreshCwIcon, WaypointsIcon } from "lucide-react";

/* ── 管理菜单定义 ────────────────────────────────────────────── */

type AdminSection = "ingest" | "appearance" | "routes" | "tunnels";

const MENU: Array<{ key: AdminSection; path: string; label: string; icon: typeof FileUpIcon }> = [
  { key: "ingest", path: "/admin/ingest", label: "文档导入", icon: FileUpIcon },
  { key: "appearance", path: "/admin/appearance", label: "界面切换", icon: PaletteIcon },
  { key: "routes", path: "/admin/routes", label: "接口路由", icon: WaypointsIcon },
  { key: "tunnels", path: "/admin/tunnels", label: "隧道代理", icon: CableIcon },
];

function sectionFrom(pathname: string): AdminSection {
  if (pathname.startsWith("/admin/appearance")) return "appearance";
  if (pathname.startsWith("/admin/routes")) return "routes";
  if (pathname.startsWith("/admin/tunnels")) return "tunnels";
  return "ingest";
}

/* ── 内容区块 ────────────────────────────────────────────────── */

function SectionHeader({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-base font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function IngestSection() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title="文档导入" />
      <IngestUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
      <DocumentList refreshKey={refreshKey} />
    </section>
  );
}

function AppearanceSection() {
  return (
    <section>
      <SectionHeader
        title="界面切换"
        description="选择喜爱的前端界面"
      />
      <UIList />
    </section>
  );
}

/* ── 接口路由 ──────────────────────────────────────────────── */

interface RouteInfo {
  name: string;
  method: string;
  path: string;
  parameters?: string[];
}

interface RoutesResponse {
  records?: RouteInfo[];
}

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  DELETE: "bg-destructive/10 text-destructive",
  PATCH: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  HEAD: "bg-muted text-muted-foreground",
};

function RoutesSection() {
  const [routes, setRoutes] = useState<RouteInfo[] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    apiFetch("/api/routes")
      .then((r) => r.json() as Promise<RoutesResponse>)
      .then((data) => setRoutes(data.records ?? []))
      .catch((e) => toast({ ...problemMessage(e), variant: "error" }));
  }, [toast]);

  return (
    <section>
      <SectionHeader title="接口路由" description="后端当前注册的路由列表" />
      {routes === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : routes.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无路由</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="w-24 px-3 py-2 text-xs font-semibold text-foreground">方法</th>
                <th className="px-3 py-2 text-xs font-semibold text-foreground">路径</th>
                <th className="w-48 px-3 py-2 text-xs font-semibold text-foreground">名字</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((rt, i) => (
                <tr
                  key={`${rt.method}-${rt.path}-${i}`}
                  className="border-t transition-colors hover:bg-muted/50"
                >
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={cn(METHOD_STYLES[rt.method] ?? "bg-muted text-muted-foreground")}
                    >
                      {rt.method}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <code className="font-mono text-xs">{rt.path}</code>
                  </td>
                  <td className="truncate px-3 py-2 text-xs text-muted-foreground">
                    {rt.name || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── 隧道代理 ──────────────────────────────────────────────── */

interface TunnelStat {
  /** 后端以 string 形式序列化（json:"id,string"） */
  id: string;
  address: string;
  source_addr: string;
  destination_addr: string;
  established_at: string;
}

interface TunnelsResponse {
  data?: TunnelStat[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** 已建立时长：从 established_at 到当前时间，按量级选择单位。 */
function formatDuration(iso: string): string {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return "-";

  const secs = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (secs < 60) return `${secs} 秒`;

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} 分 ${secs % 60} 秒`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时 ${mins % 60} 分`;

  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
}

function TunnelField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[0.65rem] text-muted-foreground">{label}</span>
      <code className="truncate font-mono text-xs" title={value}>
        {value || "-"}
      </code>
    </div>
  );
}

function TunnelsSection() {
  const [tunnels, setTunnels] = useState<TunnelStat[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // notify=false 用于轮询，避免后端持续不可用时反复弹 toast。
  const load = useCallback(
    async (notify: boolean) => {
      try {
        const resp = await apiFetch("/api/tunnels");
        const data = (await resp.json()) as TunnelsResponse;
        setTunnels(data.data ?? []);
      } catch (e) {
        if (notify) toast({ ...problemMessage(e), variant: "error" });
      }
    },
    [toast]
  );

  useEffect(() => {
    void load(true);
    const id = window.setInterval(() => void load(false), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const manualRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="隧道代理"
        description="当前通过隧道接入的活动连接"
        action={
          <div className="flex items-center gap-2">
            {tunnels !== null && (
              <Badge variant="secondary">{tunnels.length} 条</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void manualRefresh()}
              disabled={refreshing}
            >
              <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
              刷新
            </Button>
          </div>
        }
      />
      {tunnels === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : tunnels.length === 0 ? (
        <p className="text-sm text-muted-foreground">当前没有隧道连接</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tunnels.map((t, i) => (
            <div
              key={t.id || `${t.address}-${t.source_addr}-${i}`}
              className="rounded-lg border p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                  #{t.id}
                </span>
                <code className="truncate font-mono text-xs font-medium" title={t.address}>
                  {t.address}
                </code>
                <Badge
                  variant="secondary"
                  className="ml-auto shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  {formatDuration(t.established_at)}
                </Badge>
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <TunnelField label="来源" value={t.source_addr} />
                <TunnelField label="目标" value={t.destination_addr} />
                <TunnelField label="建立时间" value={formatTime(t.established_at)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── 管理后台页（左侧菜单 + 右侧内容） ───────────────────────── */

export function AdminPage() {
  const pathname = usePathname();
  const section = sectionFrom(pathname);

  return (
    <div className="flex h-full">
      {/* 左侧管理菜单 */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <nav className="flex flex-col gap-1 p-2">
          {MENU.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右侧内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-6 py-6">
          {section === "ingest" && <IngestSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "routes" && <RoutesSection />}
          {section === "tunnels" && <TunnelsSection />}
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IngestUpload } from "@/components/IngestUpload";
import { DocumentList } from "@/components/DocumentList";
import { UIList } from "@/components/UIList";
import { GitHubIcon } from "@/components/GitHubIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch, problemMessage } from "@/lib/problem";
import { useToast } from "@/components/ui/toast";
import { usePathname, navigate } from "@/lib/router";
import {
  BoxesIcon,
  CableIcon,
  CalendarClockIcon,
  CpuIcon,
  FileUpIcon,
  FolderIcon,
  GitCommitHorizontalIcon,
  HammerIcon,
  MonitorIcon,
  PaletteIcon,
  RefreshCwIcon,
  TerminalIcon,
  UserIcon,
  WaypointsIcon,
} from "lucide-react";

/* ── 管理菜单定义 ────────────────────────────────────────────── */

type AdminSection = "ingest" | "appearance" | "routes" | "tunnels" | "system";

const MENU: Array<{ key: AdminSection; path: string; label: string; icon: typeof FileUpIcon }> = [
  { key: "ingest", path: "/admin/ingest", label: "文档导入", icon: FileUpIcon },
  { key: "appearance", path: "/admin/appearance", label: "界面切换", icon: PaletteIcon },
  { key: "routes", path: "/admin/routes", label: "接口路由", icon: WaypointsIcon },
  { key: "tunnels", path: "/admin/tunnels", label: "隧道代理", icon: CableIcon },
  { key: "system", path: "/admin/system", label: "系统信息", icon: CpuIcon },
];

function sectionFrom(pathname: string): AdminSection {
  if (pathname.startsWith("/admin/appearance")) return "appearance";
  if (pathname.startsWith("/admin/routes")) return "routes";
  if (pathname.startsWith("/admin/tunnels")) return "tunnels";
  if (pathname.startsWith("/admin/system")) return "system";
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

/* ── 系统信息 ──────────────────────────────────────────────── */

/** 对应 Go 的 debug.BuildInfo / Module / BuildSetting（无 json tag，字段名首字母大写）。 */
interface BuildModule {
  Path: string;
  Version: string;
}

interface GoBuildInfo {
  GoVersion?: string;
  Path?: string;
  Main?: BuildModule;
  Deps?: BuildModule[];
  Settings?: Array<{ Key: string; Value: string }>;
}

/** 对应后端 bininfo.Info。 */
interface SystemInfo {
  goos?: string;
  goarch?: string;
  version?: string;
  revision?: string;
  username?: string;
  workdir?: string;
  module?: string;
  committed_at?: string;
  build_info?: GoBuildInfo;
}

/** 概览区的小标签：等宽字体 + 淡色底，与正文信息区分。 */
function MetaChip({ icon: Icon, title, children }: {
  icon: typeof CpuIcon;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className="inline-flex h-6 max-w-48 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 text-[0.7rem] text-muted-foreground"
    >
      <Icon className="size-3 shrink-0 opacity-70" />
      <span className="truncate font-mono">{children}</span>
    </span>
  );
}

/** 概览字段：标签在上、值在下；长值截断，hover 可见完整内容。 */
function InfoField({ icon: Icon, label, value }: {
  icon: typeof CpuIcon;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
        <Icon className="size-3 shrink-0 opacity-70" />
        {label}
      </span>
      <code className={cn("truncate font-mono text-xs", !value && "text-muted-foreground")} title={value}>
        {value || "-"}
      </code>
    </div>
  );
}

/** 键值列表，用于构建参数 / 依赖模块。keyWidth 可按内容调整左列宽度，href 可让键名变成外链。 */
function KeyValueRows({ rows, keyWidth = "w-44" }: {
  rows: Array<{ key: string; value?: string; href?: string }>;
  keyWidth?: string;
}) {
  return (
    <div className="divide-y divide-border/60">
      {rows.map((row, i) => (
        <div
          key={`${row.key}-${i}`}
          className="flex items-start gap-3 px-3 py-1.5 transition-colors hover:bg-muted/40"
        >
          {row.href ? (
            <a
              href={row.href}
              target="_blank"
              rel="noreferrer"
              title={`在 pkg.go.dev 查看 ${row.key}`}
              className={cn(
                "shrink-0 break-all font-mono text-xs text-primary hover:underline",
                keyWidth
              )}
            >
              {row.key}
            </a>
          ) : (
            <span className={cn("shrink-0 break-all font-mono text-xs text-muted-foreground", keyWidth)}>
              {row.key}
            </span>
          )}
          <span className={cn("min-w-0 break-all font-mono text-xs", !row.value && "text-muted-foreground")}>
            {row.value || "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 卡片外框：统一的圆角、描边与卡片底色。 */
function InfoCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>{children}</div>
  );
}

/** 卡片标题栏：图标 + 标题 + 紧随其后的计数。 */
function InfoCardHeader({ icon: Icon, title, count }: {
  icon: typeof CpuIcon;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-xs font-semibold text-foreground">{title}</span>
      {typeof count === "number" && <Badge variant="secondary">{count}</Badge>}
    </div>
  );
}

function SystemSection() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const { toast } = useToast();

  const load = useCallback(
    async (notify: boolean) => {
      try {
        const resp = await apiFetch("/api/system/buildinfo");
        setInfo((await resp.json()) as SystemInfo);
      } catch (e) {
        if (notify) toast({ ...problemMessage(e), variant: "error" });
      }
    },
    [toast]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const build = info?.build_info;
  const settings = build?.Settings ?? [];
  const deps = build?.Deps ?? [];
  const platform =
    info?.goos || info?.goarch ? `${info.goos ?? "?"}/${info.goarch ?? "?"}` : "";
  const repoURL =
    info?.module && info?.revision
      ? `https://${info.module}/tree/${info.revision}`
      : "";
  // 后端返回的 version 形如 "2026.9.30+d2209c0"（不带 v 前缀），展示时统一补上
  const versionLabel = info?.version
    ? info.version.startsWith("v")
      ? info.version
      : `v${info.version}`
    : "";

  return (
    <section className="flex flex-col gap-4">
      {info === null ? (
        <div className="flex flex-col gap-4">
          <div className="h-32 animate-pulse rounded-xl border bg-muted/30" />
          <div className="h-20 animate-pulse rounded-xl border bg-muted/30" />
        </div>
      ) : (
        <>
          {/* 概览：版本为主视觉，右侧为运行环境标签，下方为详细字段 */}
          <InfoCard className="p-4">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CpuIcon className="size-5" />
              </span>
              <div className="min-w-40 flex-1">
                <span className="block font-mono text-lg leading-tight font-semibold tracking-tight">
                  {versionLabel || "未知版本"}
                </span>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <GitHubIcon className="size-3 shrink-0 text-muted-foreground" />
                  {repoURL ? (
                    <a
                      href={repoURL}
                      target="_blank"
                      rel="noreferrer"
                      title={repoURL}
                      className="min-w-0 truncate font-mono text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
                    >
                      {info.module || "-"}
                    </a>
                  ) : (
                    <span
                      className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                      title={info.module}
                    >
                      {info.module || "-"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {platform && (
                  <MetaChip icon={MonitorIcon} title="运行平台">
                    {platform}
                  </MetaChip>
                )}
                {build?.GoVersion && (
                  <MetaChip icon={TerminalIcon} title="编译使用的 Go 版本">
                    {build.GoVersion}
                  </MetaChip>
                )}
                {info.revision && (
                  <MetaChip icon={GitCommitHorizontalIcon} title={info.revision}>
                    {info.revision.slice(0, 7)}
                  </MetaChip>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoField
                icon={CalendarClockIcon}
                label="提交时间"
                value={info.committed_at ? formatTime(info.committed_at) : ""}
              />
              <InfoField icon={GitCommitHorizontalIcon} label="修订版本" value={info.revision} />
              <InfoField icon={UserIcon} label="运行用户" value={info.username} />
              <InfoField icon={FolderIcon} label="工作目录" value={info.workdir} />
            </div>
          </InfoCard>

          {deps.length > 0 && (
            <InfoCard>
              <InfoCardHeader icon={BoxesIcon} title="依赖模块" count={deps.length} />
              <KeyValueRows
                rows={deps.map((d) => ({
                  key: d.Path,
                  value: d.Version,
                  // 带上版本号可直达该版本的文档；缺版本号时退化为模块首页
                  href: d.Version
                    ? `https://pkg.go.dev/${d.Path}@${d.Version}`
                    : `https://pkg.go.dev/${d.Path}`,
                }))}
                keyWidth="w-full max-w-[min(100%,32rem)] sm:w-[32rem]"
              />
            </InfoCard>
          )}

          {settings.length > 0 && (
            <InfoCard>
              <InfoCardHeader icon={HammerIcon} title="构建参数" count={settings.length} />
              <KeyValueRows rows={settings.map((s) => ({ key: s.Key, value: s.Value }))} />
            </InfoCard>
          )}
        </>
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
        <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-6">
          {section === "ingest" && <IngestSection />}
          {section === "appearance" && <AppearanceSection />}
          {section === "routes" && <RoutesSection />}
          {section === "tunnels" && <TunnelsSection />}
          {section === "system" && <SystemSection />}
        </div>
      </div>
    </div>
  );
}
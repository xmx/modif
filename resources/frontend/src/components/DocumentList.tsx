import { useCallback, useEffect, useRef, useState } from "react";
import { FileTextIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocumentItem {
  id: string;
  source: string;
  size?: number;
  point_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

interface DocumentsResponse {
  page: number;
  size: number;
  total: number;
  records?: DocumentItem[];
}

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10 篇 / 页" },
  { value: "20", label: "20 篇 / 页" },
  { value: "50", label: "50 篇 / 页" },
  { value: "100", label: "100 篇 / 页" },
];

function formatTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** 字节数格式化：B / KB / MB / GB。 */
function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** 生成带省略号的分页页码序列，例如 [1, "ellipsis", 4, 5, 6, "ellipsis", 10]。 */
function buildPageList(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 0) return [];
  const items: Array<number | "ellipsis"> = [];
  const delta = 1;
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  items.push(1);
  if (left > 2) items.push("ellipsis");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push("ellipsis");
  if (total > 1) items.push(total);

  return items;
}

/** 删除按钮 + hover 确认弹层。 */
function ConfirmDelete({ doc, deleting, onDelete }: {
  doc: DocumentItem;
  deleting: boolean;
  onDelete: (doc: DocumentItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        disabled={deleting}
        onClick={() => setOpen((v) => !v)}
        className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer disabled:opacity-50"
        title="删除文档"
      >
        <Trash2Icon className="size-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border bg-popover p-2 shadow-md ring-1 ring-foreground/10">
          <p className="mb-2 flex items-center gap-0.5 px-1 text-xs text-muted-foreground">
            <span className="shrink-0">删除「</span>
            <span className="min-w-0 flex-1 truncate">{doc.source}</span>
            <span className="shrink-0">」？</span>
          </p>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onDelete(doc);
              }}
              disabled={deleting}
              className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground transition-colors hover:bg-destructive/90 cursor-pointer disabled:opacity-50"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 已导入文档列表：通过 GET /api/documents 分页拉取，支持删除与翻页。 */
export function DocumentList({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), size: String(size) });
    fetch(`/api/documents?${qs.toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<DocumentsResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((res) => {
        setData(res);
        // 后端会把越界页码修正为最后一页，同步回本地
        if (res.page !== page) setPage(res.page);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [page, size]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const remove = async (doc: DocumentItem) => {
    setDeletingId(doc.id);
    setDeleteError(null);
    try {
      const resp = await fetch(`/api/document/${encodeURIComponent(doc.id)}`, {
        method: "DELETE",
      });
      if (!resp.ok) {
        throw new Error(`删除失败（HTTP ${resp.status}）`);
      }
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const currentSize = data?.size ?? size;
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / currentSize)) : 0;
  const pageList = buildPageList(page, totalPages);

  const changeSize = (v: number) => {
    setSize(v);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">已导入文档</h3>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer disabled:opacity-50"
        >
          <RefreshCwIcon className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
          刷新
        </button>
      </div>

      {deleteError && (
        <p className="text-sm text-destructive">{deleteError}</p>
      )}

      {error ? (
        <p className="text-sm text-destructive">加载失败：{error}</p>
      ) : loading && data === null ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : records.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          暂无已导入的文档
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            {records.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 border-t px-3 py-2 first:border-t-0 hover:bg-muted/50"
              >
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {doc.source}
                </span>
                <span className="shrink-0 tabular-nums text-[0.65rem] text-muted-foreground">
                  {doc.size != null ? formatBytes(doc.size) : "-"}
                </span>
                <span className="shrink-0 text-[0.65rem] text-muted-foreground/50">·</span>
                <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                  {formatTime(doc.updated_at || doc.created_at)}
                </span>
                <ConfirmDelete
                  doc={doc}
                  deleting={deletingId === doc.id}
                  onDelete={remove}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              共 {total} 篇
            </span>

            <Pagination className="mx-0 w-auto flex-1 justify-center">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="上一页"
                    aria-disabled={page <= 1 || loading}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={cn((page <= 1 || loading) && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>

                {pageList.map((item, idx) =>
                  item === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href="#"
                        size="icon"
                        isActive={item === page}
                        onClick={(e) => {
                          e.preventDefault();
                          if (item !== page) setPage(item);
                        }}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="下一页"
                    aria-disabled={page >= totalPages || loading}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    className={cn((page >= totalPages || loading) && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              <span>每页</span>
              <Select
                value={String(size)}
                onValueChange={(value) => {
                  if (value != null) changeSize(Number(value));
                }}
                items={PAGE_SIZE_OPTIONS}
              >
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
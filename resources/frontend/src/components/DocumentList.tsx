import { useCallback, useEffect, useRef, useState } from "react";
import { FileTextIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";

interface DocumentItem {
  id: string;
  source: string;
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

function formatTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

/** 已导入文档列表：通过 GET /api/documents 拉取，支持删除。 */
export function DocumentList({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/documents")
      .then((r) => (r.ok ? (r.json() as Promise<DocumentsResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="flex flex-col gap-1 rounded-lg border">
          {records.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50"
            >
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {doc.source}
              </span>
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
      )}

      {data && data.total > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          共 {data.total} 篇文档（显示前 {records.length} 篇）
        </p>
      )}
    </div>
  );
}
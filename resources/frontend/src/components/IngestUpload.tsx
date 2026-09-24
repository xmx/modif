import { useRef, useState } from "react";
import {
  FileTextIcon,
  UploadIcon,
  AlertTriangleIcon,
  Loader2Icon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, problemMessage } from "@/lib/problem";
import { useToast } from "@/components/ui/toast";

/** 允许上传的文本文档扩展名。 */
const ALLOWED_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "text",
  "html",
  "htm",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "csv",
  "tsv",
  "log",
  "xml",
  "css",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "go",
  "py",
  "java",
  "c",
  "h",
  "cpp",
  "hpp",
  "rs",
  "sh",
  "bat",
  "ps1",
  "sql",
  "toml",
  "ini",
  "conf",
  "cfg",
  "env",
  "rst",
  "adoc",
]);

const ACCEPT = ".md,.markdown,.txt,.text,.html,.htm,.json,.jsonc,.yaml,.yml,.csv,.tsv,.log,.xml,.css,.js,.mjs,.cjs,.ts,.tsx,.jsx,.go,.py,.java,.c,.h,.cpp,.hpp,.rs,.sh,.bat,.ps1,.sql,.toml,.ini,.conf,.cfg,.env,.rst,.adoc";

/** 单文件大小上限：500KB。 */
const MAX_SIZE_BYTES = 500 * 1024;

function extName(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i <= 0 || i === filename.length - 1) return "";
  return filename.slice(i + 1).toLowerCase();
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type FileStatus = "pending" | "uploading" | "success" | "error";

interface FileTask {
  id: string;
  file: File;
  status: FileStatus;
  message?: string;
}

const STATUS_TEXT: Record<FileStatus, string> = {
  pending: "等待上传",
  uploading: "上传中…",
  success: "成功",
  error: "失败",
};

interface IngestUploadProps {
  onUploaded?: () => void;
}

/** 文本文档导入区域：支持多选/多文件拖拽，逐个上传并标识每个文件的成功/失败。 */
export function IngestUpload({ onUploaded }: IngestUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [tasks, setTasks] = useState<FileTask[]>([]);

  const queueRef = useRef<FileTask[]>([]);
  const processingRef = useRef(false);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const patchTask = (id: string, patch: Partial<FileTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  /** 校验单个文件，返回失败原因；合法则返回 null。 */
  const validate = (file: File): string | null => {
    const ext = extName(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return "不支持的文件类型（仅支持 md / txt / html 等文本文件）";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "超过 500KB 大小限制";
    }
    return null;
  };

  const uploadOne = async (task: FileTask) => {
    patchTask(task.id, { status: "uploading" });
    try {
      const text = await task.file.text();
      await apiFetch("/api/document/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: task.file.name, content: text }),
      });
      patchTask(task.id, { status: "success" });
      return true;
    } catch (e) {
      const msg = problemMessage(e);
      patchTask(task.id, {
        status: "error",
        message: msg.detail ? `${msg.title}：${msg.detail}` : msg.title,
      });
      toast({ ...msg, variant: "error" });
      return false;
    }
  };

  /** 顺序消费队列：逐个上传，处理过程中新加入的文件也会被继续处理。 */
  const drain = async () => {
    if (processingRef.current) return; // 已有 drain 在跑，while 循环会顺带消化新文件
    processingRef.current = true;
    let succeeded = 0;
    try {
      while (queueRef.current.length > 0) {
        const task = queueRef.current.shift();
        if (!task) continue;
        if (await uploadOne(task)) succeeded++;
      }
      if (succeeded > 0) onUploaded?.();
    } finally {
      processingRef.current = false;
      // 处理边界情况：上一轮 while 结束后、清理标记前又有新文件入队
      if (queueRef.current.length > 0) void drain();
    }
  };

  const addFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (files.length === 0) return;

    const tasksToAdd: FileTask[] = files.map((file) => {
      const error = validate(file);
      if (error) {
        return { id: uid(), file, status: "error" as const, message: error };
      }
      return { id: uid(), file, status: "pending" as const };
    });

    setTasks((prev) => [...prev, ...tasksToAdd]);
    // 只有合法文件才进入上传队列；校验失败的直接以上面「失败」状态展示
    queueRef.current.push(...tasksToAdd.filter((t) => t.status === "pending"));
    void drain();
  };

  const openPicker = () => inputRef.current?.click();

  // 当前进度快照
  const uploadingCount = tasks.filter((t) => t.status === "uploading").length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const successCount = tasks.filter((t) => t.status === "success").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;
  const busy = uploadingCount > 0 || pendingCount > 0;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          resetInput();
        }}
      />

      {/* 上传区域 */}
      <button
        type="button"
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
        )}
      >
        {busy ? (
          <>
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              正在导入 {uploadingCount + pendingCount} 个文件…
            </span>
            <span className="text-xs text-muted-foreground">
              已完成 {successCount}，失败 {errorCount}
            </span>
          </>
        ) : successCount > 0 && uploadingCount + pendingCount === 0 ? (
          <>
            <CheckCircle2Icon className="size-8 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              已处理 {successCount} 个文件
            </span>
            <span className="text-xs text-muted-foreground">可继续选择更多文档</span>
          </>
        ) : (
          <>
            <FileTextIcon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">点击或拖拽文件到此处上传（支持多选）</span>
            <span className="text-xs text-muted-foreground">
              支持 md / txt / html 等文本文件，单文件 ≤ 500KB，逐个上传
            </span>
          </>
        )}
      </button>

      {/* 上传中的辅助说明 */}
      {tasks.length === 0 && (
        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <UploadIcon className="size-3.5" />
          <span>文件内容将被解析并写入向量库</span>
        </div>
      )}

      {/* 每个文件的上传结果 */}
      {tasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>共 {tasks.length} 个文件</span>
            <span>
              成功 <span className="text-emerald-600 dark:text-emerald-400">{successCount}</span>
              {" · "}
              失败 <span className="text-destructive">{errorCount}</span>
            </span>
          </div>

          <ul className="overflow-hidden rounded-lg border">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 border-t px-3 py-2 first:border-t-0"
              >
                {task.status === "uploading" ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" />
                ) : task.status === "success" ? (
                  <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                ) : task.status === "error" ? (
                  <AlertTriangleIcon className="size-4 shrink-0 text-destructive" />
                ) : (
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                )}

                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={task.file.name}>
                  {task.file.name}
                </span>
                <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                  {formatBytes(task.file.size)}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    task.status === "success" && "text-emerald-600 dark:text-emerald-400",
                    task.status === "error" && "text-destructive",
                    task.status === "uploading" && "text-primary",
                    task.status === "pending" && "text-muted-foreground"
                  )}
                  title={task.message}
                >
                  {STATUS_TEXT[task.status]}
                </span>
              </li>
            ))}
          </ul>

          {tasks.some((t) => t.status === "error" && t.message) && (
            <ul className="flex flex-col gap-1 px-1">
              {tasks
                .filter((t) => t.status === "error" && t.message)
                .map((t) => (
                  <li key={t.id} className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="font-mono">{t.file.name}</span>：{t.message}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
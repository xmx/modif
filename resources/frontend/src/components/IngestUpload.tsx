import { useRef, useState } from "react";
import {
  FileTextIcon,
  UploadIcon,
  AlertTriangleIcon,
  Loader2Icon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface IngestState {
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
  filename?: string;
}

/** 文本文档导入区域：点击或拖拽上传，平铺显示。 */
export function IngestUpload({ onUploaded }: { onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<IngestState>({ status: "idle" });

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    // 1. 校验扩展名
    const ext = extName(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      setState({
        status: "error",
        message: "仅支持文本文档（md / txt / html 等），不支持该文件类型。",
        filename: file.name,
      });
      return;
    }

    // 2. 校验大小（<= 500KB）
    if (file.size > MAX_SIZE_BYTES) {
      setState({
        status: "error",
        message: "文件大小超过 500KB 限制，请压缩后重试。",
        filename: file.name,
      });
      return;
    }

    setState({ status: "uploading", filename: file.name });

    try {
      const text = await file.text();
      const resp = await fetch("/api/document/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: file.name, content: text }),
      });
      if (!resp.ok) {
        throw new Error(`上传失败（HTTP ${resp.status}）`);
      }
      setState({ status: "success", message: `已导入：${file.name}`, filename: file.name });
      onUploaded?.();
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "上传失败",
        filename: file.name,
      });
    } finally {
      resetInput();
    }
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
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
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        disabled={state.status === "uploading"}
        className={cn(
          "flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer disabled:cursor-not-allowed",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
        )}
      >
        {state.status === "uploading" ? (
          <>
            <Loader2Icon className="size-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              正在导入 {state.filename}…
            </span>
          </>
        ) : state.status === "success" ? (
          <>
            <CheckCircle2Icon className="size-8 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {state.message}
            </span>
            <span className="text-xs text-muted-foreground">可继续上传其他文档</span>
          </>
        ) : state.status === "error" ? (
          <>
            <AlertTriangleIcon className="size-8 text-destructive" />
            <span className="text-sm text-destructive">{state.message}</span>
            <span className="text-xs text-muted-foreground">点击重试或重新选择文件</span>
          </>
        ) : (
          <>
            <FileTextIcon className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">点击或拖拽文件到此处上传</span>
            <span className="text-xs text-muted-foreground">
              支持 md / txt / html 等文本文件，单文件 ≤ 500KB
            </span>
          </>
        )}
      </button>

      {/* 上传中的辅助说明 */}
      {state.status === "idle" && (
        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <UploadIcon className="size-3.5" />
          <span>文件内容将被解析并写入向量库</span>
        </div>
      )}
    </div>
  );
}
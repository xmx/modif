import { useEffect, useMemo, useRef, useState } from "react";
import type { AuditItem, AuditBlock } from "@/hooks/useStore";
import {
  CheckIcon,
  BanIcon,
  FileSearchIcon,
  AlertTriangleIcon,
  CodeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BLOCK_REASONS = [
  { label: "涉政" },
  { label: "色情" },
  { label: "隐私泄露" },
  { label: "其他" },
];

/** 阻断统一返回 HTTP 403 */
const BLOCK_CODE = 403;

interface AuditPanelProps {
  items: AuditItem[];
  onResolve: (id: AuditItem["id"], params: unknown) => void;
  onBlock: (item: AuditItem, block: AuditBlock) => void;
  onDismiss: (id: AuditItem["id"]) => void;
}

export function AuditPanel({ items, onResolve, onBlock, onDismiss }: AuditPanelProps) {
  if (items.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[420px]">
      <div className="w-full rounded-xl border bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <FileSearchIcon className="size-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">待审计请求</span>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {items.length}
          </span>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto p-4">
          {items.map((item) => (
            <AuditItemCard
              key={item.id}
              item={item}
              onResolve={onResolve}
              onBlock={onBlock}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface AuditItemCardProps {
  item: AuditItem;
  onResolve: (id: AuditItem["id"], params: unknown) => void;
  onBlock: (item: AuditItem, block: AuditBlock) => void;
  onDismiss: (id: AuditItem["id"]) => void;
}

function useCountdown(seconds: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(seconds);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    setRemaining(seconds);
    if (seconds == null || seconds <= 0) return;

    const started = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const left = seconds - elapsed;
      if (left <= 0) {
        setRemaining(0);
        window.clearInterval(id);
        expireRef.current();
      } else {
        setRemaining(left);
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [seconds]);

  return remaining;
}

// 把修改后的最新用户消息写回 params 中最后一条 role=user 消息的 content
function applyUserEdit(params: unknown, newContent: string): unknown {
  if (typeof params !== "object" || params === null) return params;
  const p = params as { messages?: Array<{ role?: string; content?: unknown }> };
  if (!Array.isArray(p.messages)) return params;
  for (let k = p.messages.length - 1; k >= 0; k--) {
    const m = p.messages[k];
    if (m && m.role === "user") {
      m.content = newContent;
      break;
    }
  }
  return p;
}

function AuditItemCard({ item, onResolve, onBlock, onDismiss }: AuditItemCardProps) {
  const [text, setText] = useState(item.paramsRaw);
  const [userText, setUserText] = useState(item.userMessage ?? "");

  // 当切换 item 时同步文本内容（例如队列变化）
  useEffect(() => {
    setText(item.paramsRaw);
    setUserText(item.userMessage ?? "");
  }, [item.id, item.paramsRaw, item.userMessage]);

  const jsonError = useMemo(() => {
    try {
      JSON.parse(text);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "JSON 格式错误";
    }
  }, [text]);

  // 改写通过：把修改后的最新内容写回 params，作为 result 返回给网关
  const approve = () => {
    if (jsonError) return;
    const params = applyUserEdit(JSON.parse(text), userText);
    onResolve(item.id, params);
  };

  // 内容审查：直接按预置快捷原因返回 403 阻断该请求
  const blockWith = (r: (typeof BLOCK_REASONS)[number]) => {
    onBlock(item, { code: BLOCK_CODE, message: r.label });
  };

  // 倒计时读秒，归零时自动关闭审批窗口
  const remaining = useCountdown(item.timeoutSeconds, () => onDismiss(item.id));

  return (
    <div className="rounded-lg border bg-background/50">
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">{item.model}</span>
          <span className="truncate text-[0.65rem] text-muted-foreground">
            {item.requestId}
          </span>
          {remaining != null && (
            <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
              {remaining}s
            </span>
          )}
        </div>
        {item.userMessage && (
          <div className="mb-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
            <span>最新消息（快捷修改）</span>
          </div>
        )}
        {item.userMessage && (
          <input
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
          />
        )}
      </div>

      {/* params JSON 编辑器 */}
      <div className="px-3 pb-2">
        <div className="mb-1 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
          <CodeIcon className="size-3" />
          <span>请求参数（可直接改写后提交）</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className={cn(
            "h-40 w-full resize-y rounded-md border bg-muted/40 p-2 font-mono text-[0.7rem] leading-relaxed outline-none focus:ring-1 focus:ring-ring",
            jsonError ? "border-destructive/60" : "border-border"
          )}
        />
        {jsonError && (
          <div className="mt-1 flex items-center gap-1 text-[0.65rem] text-destructive">
            <AlertTriangleIcon className="size-3" />
            <span className="truncate">{jsonError}</span>
          </div>
        )}
      </div>

      {/* 操作区：第一行改写提交（含倒数），第二行并排阻断快捷按钮 */}
      <div className="flex flex-col gap-2 px-3 pb-3">
        <button
          onClick={approve}
          disabled={!!jsonError}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckIcon className="size-3.5" />
          改写提交
          {remaining != null && (
            <span className="font-mono text-[0.7rem] tabular-nums opacity-70">
              （{remaining}s）
            </span>
          )}
        </button>
        <div className="grid grid-cols-4 gap-1.5">
          {BLOCK_REASONS.map((r) => (
            <button
              key={r.label}
              onClick={() => blockWith(r)}
              className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border border-destructive/30 px-1 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <BanIcon className="size-3 shrink-0" />
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
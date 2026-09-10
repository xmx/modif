import { memo, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isValidElement } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CheckIcon, CopyIcon, BrainIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Thinking-block splitter ─────────────────────────────────────
// 只保留真实标记；空标记会让 indexOf 恒等于 0，导致死循环。
// 这里按 DeepSeek 系模型的常见写法，实际标记请与后端/模型输出对齐。
const THINKING_PAIRS: Array<[string, string]> = [
  [" 思考", " 思考"],
];

function splitThinking(content: string): Array<{ type: "thinking" | "normal"; content: string }> {
  const parts: Array<{ type: "thinking" | "normal"; content: string }> = [];
  let last = 0;

  while (last < content.length) {
    let best = -1;
    let bestOpen = "";
    let bestClose = "";

    for (const [open, close] of THINKING_PAIRS) {
      if (!open) continue; // 防御：跳过空标记
      const idx = content.indexOf(open, last);
      if (idx !== -1 && (best === -1 || idx < best)) {
        best = idx;
        bestOpen = open;
        bestClose = close || open;
      }
    }

    if (best === -1 || !bestOpen) break;

    if (best > last) {
      parts.push({ type: "normal", content: content.slice(last, best) });
    }

    const closeIdx = content.indexOf(bestClose, best + bestOpen.length);
    if (closeIdx === -1) break; // 未闭合，剩余内容按普通文本处理

    parts.push({ type: "thinking", content: content.slice(best + bestOpen.length, closeIdx) });
    last = closeIdx + bestClose.length;
  }

  if (last < content.length) {
    parts.push({ type: "normal", content: content.slice(last) });
  }

  return parts.length > 0 ? parts : [{ type: "normal", content }];
}

// ── 从已高亮的 code ReactNode 中还原原始文本，用于复制 ──────────

function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return nodeToText(props.children);
  }
  return "";
}

// ── 代码块 + 复制按钮 ──────────────────────────────────────────

const CodeBlock = memo(function CodeBlock({
  language,
  code,
  children,
}: {
  language?: string;
  code: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between bg-muted px-4 py-2">
        <span className="text-xs text-muted-foreground">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="复制代码"
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#282c34] p-4">{children}</pre>
    </div>
  );
});

// ── react-markdown 组件映射 ────────────────────────────────────
// 由 react-markdown 负责解析与渲染（含 remark-gfm、rehype-highlight），
// 这里只做样式与复制按钮的定制。

function langFromPre(children: ReactNode): string | undefined {
  const child = Array.isArray(children) ? children[0] : children;
  if (isValidElement(child)) {
    const className = (child.props as { className?: string }).className;
    return /language-([\w-]+)/.exec(className || "")?.[1];
  }
  return undefined;
}

const components: Components = {
  // 代码块：react-markdown 默认包 <pre><code>，这里把 <pre> 换成带复制按钮的容器。
  pre: ({ children }) => (
    <CodeBlock language={langFromPre(children)} code={nodeToText(children)}>
      {children}
    </CodeBlock>
  ),
  // 行内代码不处理，保持原样；块级代码由上面的 pre 接管。
  code: ({ children, className }) => (
    <code className={cn("text-[0.8125rem] leading-relaxed", className)}>{children}</code>
  ),
  // 链接统一新窗口打开，并防止 opener 注入。
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

// ── 主渲染器（memoized — 仅 content 变化时重新解析） ────────────

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const segments = useMemo(() => splitThinking(content), [content]);

  return (
    <div className={cn("text-sm", className)}>
      {segments.map((block, i) =>
        block.type === "thinking" ? (
          <ThinkingBlock key={i} content={block.content} />
        ) : (
          <MarkdownBody key={i} content={block.content} />
        )
      )}
    </div>
  );
});

// ── Collapsible thinking block ──────────────────────────────────

const ThinkingBlock = memo(function ThinkingBlock({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <details className="group my-3 overflow-hidden rounded-lg border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <BrainIcon className="size-4 shrink-0" />
        <span>思考过程</span>
        <ChevronDownIcon className="ml-auto size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-3">
        <MarkdownBody content={content} />
      </div>
    </details>
  );
});

// ── Markdown body（memoized） ──────────────────────────────────

const MarkdownBody = memo(function MarkdownBody({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
      {content}
    </Markdown>
  );
});
import { memo, useRef, useLayoutEffect } from "react";
import type { SessionData, RequestData, ToolCallData } from "@/hooks/useStore";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircleIcon,
  MessageSquareIcon,
  Loader2Icon,
  BrainIcon,
  ChevronDownIcon,
  WrenchIcon,
  BotIcon,
  CircleUserRoundIcon,
  HelpCircleIcon,
} from "lucide-react";

export function ConversationView({ sessions, selectedSessionId }: { sessions: SessionData[]; selectedSessionId: string | null }) {
  const session = sessions.find((s) => s.sessionId === selectedSessionId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 用户是否停留在底部（决定是否自动跟随）
  const shouldAutoScroll = useRef(true);

  // 最后一条请求的文本长度：流式增长时也触发跟随
  const lastRequest = session?.requests[session.requests.length - 1];
  const lastTextLength = lastRequest ? lastRequest.text.length : 0;
  const requestCount = session?.requests.length ?? 0;

  // 当请求数量变化，或最后一条内容增长时：若用户仍在底部附近则自动跟随
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [requestCount, lastTextLength]);

  // 监听滚动：用户上翻则暂停自动跟随，回到底部附近则恢复
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 48;
  };

  if (!session) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <MessageSquareIcon className="size-16 opacity-20" />
          <p className="text-sm">选择左侧的会话查看详情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="shrink-0 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{session.userAgent}</span>
          <Badge variant="secondary" className="text-xs">{session.requests.length} 请求</Badge>
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
          {session.requests.map((req) => (
            <RequestBlock key={req.requestId} req={req} />
          ))}
          {session.requests.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">等待 AI 请求...</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── One request = one memoized block (user bubble + assistant bubble) ──

const RequestBlock = memo(function RequestBlock({ req }: { req: RequestData }) {
  return (
    <>
      {req.userMessage && (
        <UserMessage model={req.model} content={req.userMessage} />
      )}
      <AssistantMessage req={req} />
    </>
  );
});

// ── 思考过程折叠块 ──────────────────────────────────────────────

const Thinking = memo(function Thinking({ content, loading }: { content: string; loading?: boolean }) {
  const showLoading = !!loading && !content.trim();
  if (!content.trim() && !showLoading) return null;
  return (
    <details
      className="group my-2 overflow-hidden rounded-lg border bg-muted/40"
      open={showLoading}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <BrainIcon className="size-3.5 shrink-0" />
        <span>思考过程</span>
        {showLoading && (
          <span className="flex gap-0.5">
            <span className="size-1 animate-bounce rounded-full bg-muted-foreground" />
            <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        )}
        <ChevronDownIcon className="ml-auto size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      {showLoading ? (
        <div className="flex items-center gap-1.5 border-t px-3 py-2.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" />
          <span>正在思考中...</span>
        </div>
      ) : (
        <div className="whitespace-pre-wrap border-t px-3 py-2 text-xs text-muted-foreground">
          {content}
        </div>
      )}
    </details>
  );
});

// ── 工具调用卡片 ────────────────────────────────────────────────

function formatArguments(raw: string): string {
  if (!raw) return raw;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw; // 非 JSON 时按原样显示
  }
}

interface InteractionOption {
  label: string;
  description?: string;
}

interface InteractionQuestion {
  header?: string;
  question: string;
  options: InteractionOption[];
}

// 交互式提问的参数格式不统一，这里尽量兼容两种常见形态：
//   A. { question: string, options: (string | { label, description })[] }
//   B. { questions: [{ header?, question, options: [...] }] }
// 其余视为非交互式。
function parseInteractions(raw: string): InteractionQuestion[] {
  if (!raw) return [];
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }

  const q = (item: Record<string, unknown>): InteractionQuestion | null => {
    const question = typeof item.question === "string" ? item.question : null;
    if (!question) return null;
    const header = typeof item.header === "string" ? item.header : undefined;
    const options = Array.isArray(item.options)
      ? item.options.map(parseOption).filter((o): o is InteractionOption => o !== null)
      : [];
    return { header, question, options };
  };

  // 形态 B：questions 数组
  if (Array.isArray(obj.questions)) {
    return obj.questions
      .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
      .map(q)
      .filter((v): v is InteractionQuestion => v !== null);
  }

  // 形态 A：直接的 question + options
  const single = q(obj);
  return single ? [single] : [];
}

function parseOption(v: unknown): InteractionOption | null {
  if (typeof v === "string") return { label: v };
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const label = [o.label, o.name, o.title].find((x) => typeof x === "string");
  if (!label) return null;
  const description = [o.description, o.desc].find((x) => typeof x === "string");
  return { label, description };
}

const QUESTION_TOOL_NAMES = new Set(["question", "ask_question", "askQuestion", "interactive", "interaction"]);

function isInteractionCall(call: ToolCallData): boolean {
  if (QUESTION_TOOL_NAMES.has(call.name) || call.name.endsWith("_question") || call.name.endsWith("-question")) {
    return true;
  }
  // 名字不匹配时，退回到按参数结构判断。
  return parseInteractions(call.arguments).length > 0;
}

// 交互式提问专用卡片：可含标题、提问、选项（选项可带描述）
const QuestionToolBlock = memo(function QuestionToolBlock({ call }: { call: ToolCallData }) {
  const questions = parseInteractions(call.arguments);
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <HelpCircleIcon className="size-3.5 shrink-0 text-primary" />
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          提问
        </span>
        {call.id && (
          <span className="ml-auto truncate text-[0.6rem] text-muted-foreground">
            #{call.id}
          </span>
        )}
      </div>
      {questions.length > 0 ? (
        <div className="flex flex-col gap-3 px-3 py-2.5">
          {questions.map((q, qi) => (
            <div key={`${q.question}-${qi}`} className="flex flex-col gap-2">
              {q.header && (
                <div className="text-xs font-semibold text-foreground">{q.header}</div>
              )}
              <p className="text-sm">{q.question}</p>
              {q.options.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt, i) => (
                    <div
                      key={`${opt.label}-${i}`}
                      className="flex items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-medium text-primary">
                        {i + 1}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{opt.label}</span>
                        {opt.description && (
                          <span className="truncate text-[0.65rem] text-muted-foreground">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 text-[0.75rem] leading-relaxed text-foreground">
          <pre className="overflow-x-auto">
            <code>{formatArguments(call.arguments)}</code>
          </pre>
        </div>
      )}
    </div>
  );
});

const ToolCallBlock = memo(function ToolCallBlock({ calls }: { calls: ToolCallData[] }) {
  if (calls.length === 0) return null;
  return (
    <div className="my-2 flex flex-col gap-2">
      {calls.map((call, i) => {
        if (isInteractionCall(call)) {
          return <QuestionToolBlock key={call.id || `${call.name}-${i}`} call={call} />;
        }
        return (
        <div
          key={call.id || `${call.name}-${i}`}
          className="overflow-hidden rounded-lg border bg-muted/40"
        >
          {/* 头部：函数名 + 调用 ID */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <WrenchIcon className="size-3.5 shrink-0 text-primary" />
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              工具调用
            </span>
            {call.id && (
              <span className="ml-auto truncate text-[0.6rem] text-muted-foreground">
                #{call.id}
              </span>
            )}
          </div>

          {/* 函数名 */}
          <div className="flex items-baseline gap-2 px-3 pt-2">
            <span className="shrink-0 text-xs text-muted-foreground">函数名</span>
            <code className="truncate rounded bg-background/70 px-1.5 py-0.5 font-mono text-xs text-primary">
              {call.name || "(未命名)"}
            </code>
          </div>

          {/* 参数 */}
          {call.arguments && (
            <div className="px-3 pb-2 pt-1.5">
              <span className="text-xs text-muted-foreground">参数</span>
              <pre className="mt-1 overflow-x-auto rounded bg-background/60 p-2 text-[0.75rem] leading-relaxed text-foreground">
                <code>{formatArguments(call.arguments)}</code>
              </pre>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
});

// ── 用量信息（带横线分隔） ──────────────────────────────────────

const UsageBlock = memo(function UsageBlock({ usage }: { usage: RequestData["usage"] }) {
  if (!usage) return null;
  const { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total } = usage;
  return (
    <div className="my-2 flex items-center gap-3 text-[0.7rem] text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0">Tokens</span>
      <span className="shrink-0">提示 {prompt ?? "-"}</span>
      <span className="shrink-0">生成 {completion ?? "-"}</span>
      <span className="shrink-0 font-medium text-foreground">共计 {total ?? "-"}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
});

// ── 默认头像 ──────────────────────────────────────────────────

const Avatar = memo(function Avatar({ type }: { type: "user" | "assistant" }) {
  if (type === "user") {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CircleUserRoundIcon className="size-5" />
      </div>
    );
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <BotIcon className="size-5" />
    </div>
  );
});

// ── User message (static, never changes) ─────────────────────────

const UserMessage = memo(function UserMessage({ model, content }: { model: string; content: string }) {
  return (
    <div className="flex justify-end gap-2">
      <div className="flex max-w-[85%] flex-col items-end gap-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          用户
          <span className="text-[0.6rem] opacity-50">{model}</span>
        </span>
        <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
      <Avatar type="user" />
    </div>
  );
});

// ── Assistant message (re-renders during streaming, memo filters) ──

const AssistantMessage = memo(function AssistantMessage({ req }: { req: RequestData }) {
  if (req.error) {
    return (
      <div className="flex gap-2">
        <Avatar type="assistant" />
        <div className="flex max-w-[85%] flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            助手
            <span className="text-[0.6rem] opacity-50">{req.model}</span>
          </span>
          <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircleIcon className="size-3.5" />
              <span className="font-medium">{req.error.code}</span>
            </div>
            <p className="mt-1 text-muted-foreground">{req.error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (req.done) {
    return (
      <div className="flex gap-2">
        <Avatar type="assistant" />
        <div className="flex max-w-[85%] flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            助手
            <span className="text-[0.6rem] opacity-50">{req.model}</span>
          </span>
          <div className="flex flex-col gap-2">
            <Thinking content={req.thinking} />
            <ToolCallBlock calls={req.toolCalls} />
            {req.text && (
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm">
                <MarkdownRenderer content={req.text} />
              </div>
            )}
            <UsageBlock usage={req.usage} />
          </div>
        </div>
      </div>
    );
  }

  // Streaming — plain text only, no markdown parsing
  const waiting = !req.text && !req.thinking && req.toolCalls.length === 0;
  return (
    <div className="flex gap-2">
      <Avatar type="assistant" />
      <div className="flex max-w-[85%] flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          助手
          <span className="text-[0.6rem] opacity-50">{req.model}</span>
        </span>
        <div className="flex flex-col gap-2">
          <Thinking content={req.thinking} loading={waiting} />
          <ToolCallBlock calls={req.toolCalls} />
          {req.text ? (
            <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm">
              <span className="whitespace-pre-wrap">{req.text}</span>
            </div>
          ) : (
            !waiting &&
            req.toolCalls.length === 0 && (
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  等待响应...
                </span>
              </div>
            )
          )}
          <UsageBlock usage={req.usage} />
        </div>
      </div>
    </div>
  );
});
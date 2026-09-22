import { useCallback, useEffect, useReducer, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: unknown;
  meta?: { session_id?: string; client_ip?: string; request_id: string; user_agent: string; timeout_seconds?: number };
}

export interface AuditItem {
  id: string | number;
  requestId: string;
  sessionId: string;
  userAgent: string;
  model: string;
  userMessage: string | null;
  paramsRaw: string;
  /** 后端在 meta.timeout_seconds 标识的超时时间（秒），超时后自动关闭审批窗口 */
  timeoutSeconds: number | null;
}

export interface AuditBlock {
  code: number;
  message: string;
}

export interface ToolCallData {
  /** OpenAI 流式 delta 里的 tool_calls[].index，用于把分片归并到正确的工具调用 */
  index: number;
  id: string;
  name: string;
  arguments: string;
}

export interface RequestData {
  requestId: string;
  userMessage: string | null;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  error: { code: string; message: string } | null;
  done: boolean;
  timestamp: number;
  text: string;
  thinking: string;
  toolCalls: ToolCallData[];
}

export interface SessionData {
  sessionId: string;
  clientIP: string;
  userAgent: string;
  requests: RequestData[];
  createdAt: number;
  lastActivity: number;
}

type ChunkUpdate = {
  delta: string;
  thinking: string;
  toolCalls: ToolCallData[];
  usage: RequestData["usage"];
};

// ── Reducer state ───────────────────────────────────────────────

interface State {
  sessions: SessionData[];
}

type Action =
  | { type: "new"; sid: string; clientIP: string; userAgent: string; req: RequestData }
  | { type: "chunk"; rid: string; delta: string; thinking: string; toolCalls: ToolCallData[]; usage: RequestData["usage"] }
  | { type: "usage"; rid: string; usage: RequestData["usage"] }
  | { type: "done"; rid: string }
  | { type: "error"; rid: string; error: RequestData["error"] };

function mergeToolCalls(prev: ToolCallData[], deltas: ToolCallData[]): ToolCallData[] {
  // 按 index 归位，index 相同的是同一次调用的分段，需合并。
  const byIndex = new Map<number, ToolCallData>();
  for (const t of prev) byIndex.set(t.index, { ...t, arguments: t.arguments });

  for (const d of deltas) {
    const cur = byIndex.get(d.index);
    if (!cur) {
      byIndex.set(d.index, { index: d.index, id: d.id, name: d.name, arguments: d.arguments });
      continue;
    }
    if (d.id) cur.id = d.id;
    if (d.name) cur.name += d.name;
    if (d.arguments) cur.arguments += d.arguments;
  }

  // 按 index 升序还原，保证多个工具调用的显示顺序稳定。
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "new": {
      const idx = state.sessions.findIndex((s) => s.sessionId === action.sid);
      let sessions: SessionData[];
      if (idx >= 0) {
        const session = state.sessions[idx];
        if (session.requests.some((r) => r.requestId === action.req.requestId)) return state;
        sessions = state.sessions.slice();
        sessions[idx] = { ...session, clientIP: action.clientIP || session.clientIP, requests: [...session.requests, action.req], lastActivity: Date.now() };
      } else {
        sessions = [
          ...state.sessions,
          { sessionId: action.sid, clientIP: action.clientIP, userAgent: action.userAgent, requests: [action.req], createdAt: Date.now(), lastActivity: Date.now() },
        ];
      }
      return { sessions };
    }

    case "chunk": {
      let changed = false;
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const req = s.requests[ri];
        const requests = s.requests.slice();
        requests[ri] = {
          ...req,
          text: req.text + action.delta,
          thinking: req.thinking + action.thinking,
          toolCalls: action.toolCalls.length > 0 ? mergeToolCalls(req.toolCalls, action.toolCalls) : req.toolCalls,
          usage: action.usage ?? req.usage,
        };
        changed = true;
        return { ...s, requests, lastActivity: Date.now() };
      });
      return changed ? { sessions } : state;
    }

    case "done": {
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const requests = s.requests.slice();
        requests[ri] = { ...s.requests[ri], done: true };
        return { ...s, requests, lastActivity: Date.now() };
      });
      return { sessions };
    }

    case "usage": {
      let changed = false;
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const requests = s.requests.slice();
        requests[ri] = { ...s.requests[ri], usage: action.usage };
        changed = true;
        return { ...s, requests, lastActivity: Date.now() };
      });
      return changed ? { sessions } : state;
    }

    case "error": {
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const requests = s.requests.slice();
        requests[ri] = { ...s.requests[ri], done: true, error: action.error };
        return { ...s, requests, lastActivity: Date.now() };
      });
      return { sessions };
    }

    default:
      return state;
  }
}

function usageFrom(raw: unknown): RequestData["usage"] | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const prompt = v.prompt_tokens ?? v.input_tokens;
  const completion = v.completion_tokens ?? v.output_tokens;
  const total = v.total_tokens;
  if (typeof prompt !== "number" && typeof completion !== "number" && typeof total !== "number") return null;
  return {
    prompt_tokens: typeof prompt === "number" ? prompt : 0,
    completion_tokens: typeof completion === "number" ? completion : 0,
    total_tokens: typeof total === "number" ? total : (typeof prompt === "number" ? prompt : 0) + (typeof completion === "number" ? completion : 0),
  };
}

function textFromContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const texts: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const p = part as Record<string, unknown>;
    if (typeof p.text === "string") texts.push(p.text);
    else if (typeof p.content === "string") texts.push(p.content);
  }
  return texts.length > 0 ? texts.join("\n") : null;
}

function latestChatUserMessage(params: { messages?: Array<{ role?: string; content?: unknown }> } | null): string | null {
  if (!params?.messages) return null;
  for (let k = params.messages.length - 1; k >= 0; k--) {
    const m = params.messages[k];
    if (m.role === "user") return textFromContent(m.content);
  }
  return null;
}

function latestResponseInput(params: Record<string, unknown> | null): string | null {
  const input = params?.input;
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return null;
  for (let k = input.length - 1; k >= 0; k--) {
    const item = input[k];
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    if (v.role === "user") return textFromContent(v.content) ?? textFromContent(v.input);
  }
  return null;
}

function responseTextDelta(event: Record<string, unknown>): string {
  for (const key of ["delta", "text", "output_text_delta"]) {
    const v = event[key];
    if (typeof v === "string") return v;
  }
  return "";
}

function responseThinkingDelta(event: Record<string, unknown>): string {
  const delta = event.delta;
  if (typeof delta === "string" && typeof event.type === "string" && event.type.includes("reasoning")) return delta;
  for (const key of ["summary_text_delta", "reasoning_delta"] ) {
    const v = event[key];
    if (typeof v === "string") return v;
  }
  return "";
}

function responseToolCall(event: Record<string, unknown>): ToolCallData[] {
  const item = event.item;
  if (!item || typeof item !== "object") return [];
  const v = item as Record<string, unknown>;
  const type = String(v.type ?? "");
  if (!type.includes("function") && !type.includes("tool")) return [];
  const fn = (v.function ?? {}) as Record<string, unknown>;
  const index = typeof v.index === "number" ? v.index : 0;
  return [{
    index,
    id: typeof v.id === "string" ? v.id : typeof v.call_id === "string" ? v.call_id : "",
    name: typeof v.name === "string" ? v.name : typeof fn.name === "string" ? fn.name : type,
    arguments: typeof v.arguments === "string" ? v.arguments : typeof fn.arguments === "string" ? fn.arguments : "",
  }];
}

function chatChunkUpdate(chunk: Record<string, unknown>): ChunkUpdate {
  let delta = "";
  let thinking = "";
  let toolCalls: ToolCallData[] = [];
  const choices = chunk.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const d = (choice as Record<string, unknown>).delta as Record<string, unknown> | undefined;
      if (!d) continue;
      if (typeof d.content === "string") delta += d.content;
      const rc = d.reasoning_content;
      if (typeof rc === "string") thinking += rc;
      const tcs = d.tool_calls;
      if (Array.isArray(tcs)) {
        toolCalls = toolCalls.concat(
          tcs.map((tc) => {
            const t = tc as Record<string, unknown>;
            const fn = (t.function ?? {}) as { name?: unknown; arguments?: unknown };
            return {
              index: typeof t.index === "number" ? t.index : 0,
              id: typeof t.id === "string" ? t.id : "",
              name: typeof fn.name === "string" ? fn.name : "",
              arguments: typeof fn.arguments === "string" ? fn.arguments : "",
            } satisfies ToolCallData;
          })
        );
      }
    }
  }
  return { delta, thinking, toolCalls, usage: usageFrom(chunk.usage) };
}

function responseChunkUpdate(event: Record<string, unknown>): ChunkUpdate {
  return {
    delta: responseTextDelta(event),
    thinking: responseThinkingDelta(event),
    toolCalls: responseToolCall(event),
    usage: usageFrom(event.usage) ?? usageFrom((event.response as Record<string, unknown> | undefined)?.usage),
  };
}

// ── Throttled dispatch (RAF batch) ──────────────────────────────

export function useStore() {
  const [state, dispatch] = useReducer(reducer, { sessions: [] });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [manualOff, setManualOff] = useState(false);
  const reconnectTrigger = useRef(0);
  const [auditQueue, setAuditQueue] = useState<AuditItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const pendingChunks = useRef<Map<string, ChunkUpdate>>(new Map());
  const rafPending = useRef(false);

  const flushChunks = useCallback(() => {
    rafPending.current = false;
    const pending = pendingChunks.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    for (const [rid, v] of entries) {
      dispatch({ type: "chunk", rid, delta: v.delta, thinking: v.thinking, toolCalls: v.toolCalls, usage: v.usage });
    }
  }, []);

  const enqueueChunk = useCallback((rid: string, update: ChunkUpdate) => {
    if (!update.delta && !update.thinking && update.toolCalls.length === 0 && !update.usage) return;
    const existing = pendingChunks.current.get(rid);
    if (existing) {
      existing.delta += update.delta;
      existing.thinking += update.thinking;
      if (update.toolCalls.length > 0) existing.toolCalls = existing.toolCalls.concat(update.toolCalls);
      if (update.usage) existing.usage = update.usage;
    } else {
      pendingChunks.current.set(rid, update);
    }
    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(flushChunks);
    }
  }, [flushChunks]);

  const addAudit = useCallback((msg: JsonRpcMessage, rid: string, sid: string, userAgent: string, model: string, userMessage: string | null, params: unknown) => {
    if (msg.id === undefined || msg.id === null) return;
    const timeoutSeconds =
      typeof msg.meta?.timeout_seconds === "number" && msg.meta.timeout_seconds > 0
        ? msg.meta.timeout_seconds
        : null;
    setAuditQueue((q) => [
      ...q,
      {
        id: msg.id as string | number,
        requestId: rid,
        sessionId: sid,
        userAgent,
        model,
        userMessage,
        paramsRaw: JSON.stringify(params ?? {}, null, 2),
        timeoutSeconds,
      },
    ]);
  }, []);

  const handleMessage = useCallback((msg: JsonRpcMessage) => {
    const meta = msg.meta;
    if (!meta?.request_id || !msg.method) return;
    const rid = meta.request_id;
    // 部分客户端没有传会话头，后端 meta.session_id 为空；不能因此丢弃交互式请求。
    // 兜底规则：session_id > client_ip > request_id。
    const sid = meta.session_id || meta.client_ip || rid;
    const clientIP = meta.client_ip || "Unknown IP";
    const userAgent = meta.user_agent || "Unknown";

    switch (msg.method) {
      case "modif/chat-completion-new": {
        const params = msg.params as { messages?: Array<{ role?: string; content?: unknown }>; model?: string } | null;
        const userMessage = latestChatUserMessage(params);
        const req: RequestData = { requestId: rid, userMessage, model: params?.model || "unknown", usage: null, error: null, done: false, timestamp: Date.now(), text: "", thinking: "", toolCalls: [] };
        dispatch({ type: "new", sid, clientIP, userAgent, req });
        addAudit(msg, rid, sid, userAgent, req.model, userMessage, params);
        break;
      }

      case "modif/response-new": {
        const params = msg.params as Record<string, unknown> | null;
        const userMessage = latestResponseInput(params);
        const model = typeof params?.model === "string" ? params.model : "responses";
        const req: RequestData = { requestId: rid, userMessage, model, usage: null, error: null, done: false, timestamp: Date.now(), text: "", thinking: "", toolCalls: [] };
        dispatch({ type: "new", sid, clientIP, userAgent, req });
        addAudit(msg, rid, sid, userAgent, model, userMessage, params);
        break;
      }

      case "modif/chat-completion-chunk": {
        const chunk = msg.params as Record<string, unknown> | null;
        if (!chunk) break;
        enqueueChunk(rid, chatChunkUpdate(chunk));
        break;
      }

      case "modif/response-chunk": {
        const event = msg.params as Record<string, unknown> | null;
        if (!event) break;
        enqueueChunk(rid, responseChunkUpdate(event));
        break;
      }

      case "modif/chat-completion-usage": {
        const usage = usageFrom(msg.params);
        if (usage) dispatch({ type: "usage", rid, usage });
        break;
      }

      case "modif/chat-completion-done":
      case "modif/response-done": {
        flushChunks();
        dispatch({ type: "done", rid });
        break;
      }

      case "modif/chat-completion-error":
      case "modif/response-error": {
        flushChunks();
        const err = msg.params as { code?: unknown; message?: unknown } | null;
        dispatch({ type: "error", rid, error: { code: String(err?.code ?? ""), message: String(err?.message ?? "请求出错") } });
        break;
      }
    }
  }, [addAudit, enqueueChunk, flushChunks]);

  useEffect(() => {
    if (manualOff) { setConnected(false); return; }
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (stopped || manualOff) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${location.host}/api/inspect/attach`);
      wsRef.current = ws;
      ws.onopen = () => { if (!stopped) setConnected(true); };
      ws.onmessage = (e) => { if (!stopped) { try { handleMessage(JSON.parse(e.data)); } catch { /* */ } } };
      ws.onclose = (ev) => { if (!stopped) { setConnected(false); ws = null; if (!manualOff && ev.code !== 1000) reconnectTimer = setTimeout(connect, 3000); } };
      ws.onerror = () => {};
    };

    const timer = setTimeout(connect, 100);
    return () => { stopped = true; clearTimeout(timer); clearTimeout(reconnectTimer); if (ws) { ws.onclose = null; ws.onmessage = null; ws.onopen = null; ws.onerror = null; ws.close(1000); } };
  }, [manualOff, reconnectTrigger.current, handleMessage]);

  const selectSession = useCallback((id: string) => { setSelectedSessionId(id); }, []);

  const resolveAudit = useCallback((id: string | number, params: unknown) => {
    setAuditQueue((q) => q.filter((item) => item.id !== id));
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, result: params }));
  }, []);

  const blockAudit = useCallback((item: AuditItem, block: AuditBlock) => {
    setAuditQueue((q) => q.filter((x) => x.id !== item.id));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: item.id, error: { code: block.code, message: block.message } }));
    }
    dispatch({ type: "error", rid: item.requestId, error: { code: String(block.code), message: block.message } });
  }, []);

  const dismissAudit = useCallback((id: AuditItem["id"]) => {
    setAuditQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const toggleConnection = useCallback(() => {
    setManualOff((prev) => { if (!prev) reconnectTrigger.current++; return !prev; });
  }, []);

  useEffect(() => {
    if (!selectedSessionId && state.sessions.length > 0) setSelectedSessionId(state.sessions[0].sessionId);
  }, [state.sessions, selectedSessionId]);

  return {
    sessions: state.sessions,
    selectedSessionId,
    connected,
    selectSession,
    toggleConnection,
    auditQueue,
    resolveAudit,
    blockAudit,
    dismissAudit,
  };
}

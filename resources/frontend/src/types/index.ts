// JSON-RPC 2.0 types

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  /** Metadata carried by the AI gateway */
  meta?: Metadata;
  id?: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface Metadata {
  session_id: string;
  request_id: string;
  user_agent: string;
}

// OpenAI-compatible types (mirrored from the gateway)

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ChatContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: string };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionNewParams {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: unknown[];
  [key: string]: unknown;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChoiceDelta[];
  usage?: CompletionUsage | null;
  [key: string]: unknown;
}

export interface ChoiceDelta {
  index: number;
  delta: {
    role?: string;
    content?: string;
    tool_calls?: ToolCallDelta[];
  };
  finish_reason?: string | null;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ErrorMessage {
  code: string;
  message: string;
}

// Application state types

export interface Session {
  sessionId: string;
  userAgent: string;
  requests: RequestRecord[];
  createdAt: number;
  lastActivity: number;
}

export interface RequestRecord {
  requestId: string;
  /** Only the last user message from the request — not the full history */
  userMessage: string | null;
  model: string;
  usage: CompletionUsage | null;
  error: ErrorMessage | null;
  done: boolean;
  timestamp: number;
  /** Accumulated assistant content from chunks */
  accumulatedContent: string;
}

// JSON-RPC method names
export const RPC_METHODS = {
  CHAT_COMPLETION_NEW: "modif/chat-completion-new",
  CHAT_COMPLETION_CHUNK: "modif/chat-completion-chunk",
  CHAT_COMPLETION_USAGE: "modif/chat-completion-usage",
  CHAT_COMPLETION_DONE: "modif/chat-completion-done",
} as const;
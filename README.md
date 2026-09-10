# MODIF

MODIF 是一个 AI 网关，对外提供 OpenAI 兼容的接口，把请求转发给上游真实的模型服务，
同时把每一次对话的细节通过 WebSocket 实时推送给观察者，方便调试、审计或做可视化展示。

## 当前状态

项目仍在开发中，功能还不完整。目前只实现了 `chat/completions` 这一种接口的转发与监听，并且只支持流式响应。

## 运行

### 后端

先准备配置文件：

```bash
cp resources/config/application-example.jsonc resources/config/application.jsonc
```

编辑 `resources/config/application.jsonc`，填入上游服务地址和密钥：

```jsonc
{
  "openai": {
    "base_url": "https://openai.example.com/v1",
    "api_key": "sk-xxx"
  }
}
```

启动服务：

```bash
go run main/main.go
```

默认读取 `resources/config/application.jsonc`，也可以用 `-c` 指定其他路径：

```bash
go run main/main.go -c /path/to/application.jsonc
```

服务监听在 `0.0.0.0:8866`，启动后日志会打印可供客户端访问的地址。按 `Ctrl+C` 停止。

### 前端

前端位于 `resources/frontend`：

```bash
cd resources/frontend
npm install
npm run dev
```

开发模式下，前端会把 `/api` 请求（含 WebSocket）代理到 `http://localhost:8866`。
正式构建使用 `npm run build`，产物输出到 `resources/static/dist`。

## WebSocket 监听约定

连接 `ws://localhost:8866/api/inspect/attach`，使用 JSON-RPC 2.0 协议，所有消息均为通知（notification），观察者无需响应。

### 消息元信息（meta）

每条消息都带有 `meta`，字段如下：

| 字段         | 说明                                                                         |
|--------------|------------------------------------------------------------------------------|
| `request_id` | 每次请求的唯一 ID                                                            |
| `session_id` | 会话 ID，取自请求头 `X-Session-Id`（opencode）或 `Agent-Session-Id`（goose） |
| `user_agent` | 发起请求的 User-Agent                                                        |

### method 约定

method 统一以 `modif/` 为前缀，按一次请求的生命周期依次推送：

| method                        | 触发时机             | params                                                               |
|-------------------------------|----------------------|----------------------------------------------------------------------|
| `modif/chat-completion-new`   | 收到请求时           | OpenAI 的 `ChatCompletionNewParams`，含 `messages`、`model` 等       |
| `modif/chat-completion-chunk` | 每收到一个流式分片时 | OpenAI 的 `ChatCompletionChunk`，含 `choices[].delta` 与可选 `usage` |
| `modif/chat-completion-usage` | 收到用量统计时       | `{ prompt_tokens, completion_tokens, total_tokens }`                 |
| `modif/chat-completion-done`  | 请求正常结束时       | `null`                                                               |
| `modif/chat-completion-error` | 报错时               | `{ code, message }`                                                  |

其中 `chat-completion-chunk` 的 `delta` 里包含正文 `content`、思考内容 `reasoning_content` 以及工具调用增量 `tool_calls`。
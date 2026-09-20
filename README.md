# MODIF

MODIF 是一个 AI 网关，对外提供 OpenAI 兼容的接口，把请求转发给上游真实的模型服务，
同时把每一次对话的细节通过 WebSocket 实时推送给观察者，方便调试、审计、审批或做可视化展示。

## 当前状态

项目仍在开发中，目前实现了以下接口：

- `POST /v1/chat/completions`：聊天补全，支持流式
- `POST /v1/responses`：OpenAI Responses 接口，支持流式
- `GET /v1/models`：模型列表

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

服务监听在 `0.0.0.0:8866`。按 `Ctrl+C` 停止。

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

连接 `ws://localhost:8866/api/inspect/attach`，使用 JSON-RPC 2.0 协议。
按是否需要观察者响应，消息分为两类：

- **请求（request）**：`chat-completion-new`、`response-new`，观察者必须响应
- **通知（notification）**：其余事件，观察者无需响应

### 消息元信息（meta）

每条消息都带有 `meta`，字段如下：

| 字段              | 说明                                                                                |
|-------------------|-------------------------------------------------------------------------------------|
| `client_ip`       | 发起请求的客户端 IP                                                                 |
| `request_id`      | 请求 ID，优先取请求头 `X-Request-Id` 或 `X-Conversation-Request-Id`，没有则自动生成 |
| `session_id`      | 会话 ID，取自请求头，见下方说明                                                     |
| `thread_id`       | 线程 ID（预留）                                                                     |
| `user_agent`      | 发起请求的 User-Agent                                                               |
| `timeout_seconds` | 请求类消息的响应超时时间（秒），仅 request 类消息携带                               |

`session_id` 依次尝试这些请求头：

| 来源            | 请求头                               |
|-----------------|--------------------------------------|
| opencode / kilo | `X-Session-Id`、`X-Session-Affinity` |
| goose           | `Agent-Session-Id`                   |
| CodeBuddy       | `X-Conversation-Id`                  |
| codex           | `session-id`                         |

### method 约定

method 统一以 `modif/` 为前缀，按一次请求的生命周期依次推送。
下表按类型区分：`new` 为请求（需响应），其余为通知（无需响应）。

#### ChatCompletion

| method                        | 类型   | 触发时机                     | params                                                          |
|-------------------------------|--------|------------------------------|-----------------------------------------------------------------|
| `modif/chat-completion-new`   | 请求   | 收到聊天补全请求时           | OpenAI 的 `ChatCompletionNewParams`                             |
| `modif/chat-completion-chunk` | 通知   | 每收到一个流式分片时         | `ChatCompletionChunk`，含 `choices[].delta`，末尾分片带 `usage` |
| `modif/chat-completion-done`  | 通知   | 聊天补全正常结束时           | `null`                                                          |
| `modif/chat-completion-error` | 通知   | 聊天补全出错时               | JSON-RPC 错误对象                                               |

#### Response

| method                 | 类型   | 触发时机                     | params                                    |
|------------------------|--------|------------------------------|-------------------------------------------|
| `modif/response-new`   | 请求   | 收到 Responses 请求时        | OpenAI 的 `ResponseNewParams`             |
| `modif/response-chunk` | 通知   | 每收到一个流式事件时         | `ResponseStreamEvent`，部分事件带 `usage` |
| `modif/response-done`  | 通知   | Responses 正常结束时         | `null`                                    |
| `modif/response-error` | 通知   | Responses 出错时             | JSON-RPC 错误对象                         |

`new` 方法需要观察者响应：

- 返回 `result`（修改后的参数），网关用它继续请求上游
- 返回 `error`，该请求被拒绝
- 超时（默认 10 秒）或连接断开，网关用原始参数继续请求
# 订阅改写 agent

一个独立的 Node.js 工程，作为 MODIF 网关的「观察者」，订阅
`/api/inspect/attach` 的 JSON-RPC 2.0 事件流，并在每个请求到来时
**读取 `skills` 目录并把 skill 附加到请求体**。

- 语言：Node.js（CommonJS）
- 依赖：`ws`（WebSocket）、`jsonc-parser`（JSONC）、`gray-matter`（YAML frontmatter）
- 不影响后端逻辑：agent 是独立的 WebSocket 客户端，只「响应」网关推送的请求

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动后端（网关默认监听 0.0.0.0:8866）
go run main/main.go

# 3. 启动 agent（默认读取 config.jsonc，默认 skills 目录为 ./skills）
npm start
```

## 配置

默认读取 `config.jsonc`（JSONC）。目前只有三项：

```jsonc
{
  "url": "ws://127.0.0.1:8866/api/inspect/attach",
  "retry_ms": 3000,
  "skills": "skills/"
}
```

| 配置项 | 说明 |
|--------|------|
| `url` | 网关 WebSocket 地址（环境变量 `MODIF_AGENT_URL` 可作为兜底默认值） |
| `retry_ms` | 断线自动重连间隔（毫秒） |
| `skills` | skills 目录，相对路径基于 agent 目录解析，也支持绝对路径 |

命令行参数可覆盖配置文件同名项：

```bash
node index.js -c ./my-config.jsonc          # 指定配置文件
node index.js --url ws://host/api/inspect/attach   # 覆盖连接地址
node index.js --skills /path/to/skills             # 覆盖 skills 目录
```

## Skills

每个请求（`*-new`）到来时，agent **动态扫描** `skills` 目录，把其中所有
启用的 skill 附加到请求体：

- chat completions（`modif/chat-completion-new`）：注入为 `system` 消息
- responses（`modif/response-new`）：写入顶层 `instructions`

skill 是 Markdown 文件，可携带 YAML frontmatter。支持两种目录组织：

**方式一：子目录 + `SKILL.md`（多文件 skill）**

```
skills/
└── code-style/
    └── SKILL.md
```

**方式二：平铺 `.md`**

```
skills/
└── code-style.md
```

skill 内容示例：

```markdown
---
name: code-style
displayName: 代码风格
enabled: true
---
所有代码都必须使用 TypeScript 严格模式。
```

- 命名：`frontmatter.name` > `frontmatter.displayName` > 文件名/父目录名
- `enabled: false` 跳过
- 目录内容**支持热更新**，放置 / 修改 / 删除 skill 无需重启 agent

多个 skill 以 `---` 分隔，统一放在 `## Skills` 标题下，并按标题去重。

## 测试

```bash
npm test          # 离线单测 + 端到端（模拟网关回写校验）
npm run selftest  # 仅离线单测
npm run e2e       # 仅端到端
```

## 目录结构

```
resources/agent
├── index.js                  # 入口
├── config.jsonc              # 配置（url / retry_ms / skills）
├── package.json              # 元信息与依赖
├── skills/                   # 动态放置的 skill
├── lib/
│   ├── config.js             # JSONC 配置加载 / 字段映射
│   ├── jsonrpc.js            # JSON-RPC 2.0 over WebSocket 客户端（ws）
│   └── skills.js             # skill 加载 / 组装 / 注入
├── selftest.js               # 离线自测
└── test-e2e.js               # 端到端自测（基于 ws）
```
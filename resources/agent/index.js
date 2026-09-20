'use strict';

/**
 * 订阅改写 agent（MODIF 观察者）
 *
 * 连接网关的 WebSocket 接口 /api/inspect/attach，
 * 订阅 JSON-RPC 2.0 事件流，并在每个「请求类」事件（*-new）到来时，
 * 读取 skills 目录里的 skill 并附加到请求体中：
 *
 *   - chat completion:  method = modif/chat-completion-new（注入 system 消息）
 *   - responses:        method = modif/response-new（注入 instructions）
 *
 * 对通知类事件（*-chunk / *-done / *-error）仅忽略，不回包。
 *
 * 配置只有三项，见 config.jsonc：
 *   url / retry_ms / skills
 */

const path = require('path');
const { InspectClient } = require('./lib/jsonrpc');
const { loadJSONC, normalizeConfig } = require('./lib/config');
const { loadSkills, buildSkillsBlock, injectSkills } = require('./lib/skills');

const VERSION = require('./package.json').version;
const DEFAULT_CONFIG_FILE = path.join(__dirname, 'config.jsonc');
const DEFAULT_SKILLS_DIR = path.join(__dirname, 'skills');

const DEFAULTS = {
  url: process.env.MODIF_AGENT_URL || 'ws://127.0.0.1:8866/api/inspect/attach',
  retryMs: 3000,
  skillsDir: DEFAULT_SKILLS_DIR,
};

const HELP = `订阅改写 agent v${VERSION}

用法:
  node index.js [--config <file>]

默认读取 ${path.relative(process.cwd(), DEFAULT_CONFIG_FILE)}。

配置（见 config.jsonc）:
  url          WebSocket 地址
  retry_ms     断线重连间隔（毫秒）
  skills       skills 目录（相对 agent 目录或绝对路径）

选项:
  -c, --config <file>  配置文件路径（JSONC）
  --url <ws-url>       WebSocket 地址（环境变量 MODIF_AGENT_URL 同义）
  --skills <path>      skills 目录
  -v, --version        打印版本
  -h, --help           打印帮助
`;

function parseArgs(argv) {
  const cli = {};
  let configFile = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : '');
    switch (a) {
      case '-h':
      case '--help':
        cli.help = true;
        break;
      case '-v':
      case '--version':
        cli.version = true;
        break;
      case '-c':
      case '--config':
        configFile = next();
        break;
      case '--url':
        cli.url = next();
        break;
      case '--skills':
        cli.skillsDir = next();
        break;
      default:
        console.error(`未知参数：${a}`);
        process.exitCode = 2;
    }
  }

  return { cli, configFile };
}

function resolveConfig(cli, configFile) {
  const filePath = configFile || DEFAULT_CONFIG_FILE;

  let fromFile = {};
  try {
    fromFile = normalizeConfig(loadJSONC(filePath));
  } catch (err) {
    if (filePath === DEFAULT_CONFIG_FILE && err.code === 'ENOENT') {
      console.warn(`[warn] 未找到配置文件 ${filePath}，使用内置默认值`);
    } else {
      throw err;
    }
  }

  return { ...DEFAULTS, ...fromFile, ...cli };
}

function logLine(prefix, ...rest) {
  const time = new Date().toISOString();
  const line = rest.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
  process.stdout.write(`[${time}] [${prefix}] ${line}\n`);
}

function main() {
  const { cli, configFile } = parseArgs(process.argv.slice(2));
  if (cli.version) {
    console.log(VERSION);
    return;
  }
  if (cli.help || process.exitCode === 2) {
    console.log(HELP);
    return;
  }

  let cfg;
  try {
    cfg = resolveConfig(cli, configFile);
  } catch (err) {
    console.error(`[error] ${err.message}`);
    process.exit(1);
  }

  cfg.url = cfg.url || DEFAULTS.url;
  cfg.retryMs = Number(cfg.retryMs) || 3000;
  cfg.skillsDir = cfg.skillsDir || DEFAULT_SKILLS_DIR;
  if (!path.isAbsolute(cfg.skillsDir)) cfg.skillsDir = path.resolve(__dirname, cfg.skillsDir);

  const log = (...rest) => logLine(...rest);

  log('info', `订阅改写 agent 启动，目标 ${cfg.url}`);
  log('info', `skills: ${cfg.skillsDir}`);

  let reconnectTimer = null;
  let shuttingDown = false;
  let client = null;

  function attach() {
    if (shuttingDown) return;
    client = new InspectClient(cfg.url, {
      log,
      onClosed: () => {
        if (shuttingDown) return;
        log('warn', `连接断开，${cfg.retryMs}ms 后重连...`);
        reconnectTimer = setTimeout(attach, cfg.retryMs);
        reconnectTimer.unref?.();
      },
    });

    client.method('modif/chat-completion-new', handleNew);
    client.method('modif/response-new', handleNew);

    client
      .connect()
      .then(() => log('info', '已连接，等待请求...'))
      .catch((err) => {
        log('warn', err.message, `，${cfg.retryMs}ms 后重连...`);
        reconnectTimer = setTimeout(attach, cfg.retryMs);
        reconnectTimer.unref?.();
      });
  }

  function handleNew(method, params, meta) {
    const requestId = (meta && meta.request_id) || '-';

    // 每个请求到来时动态读取 skills（热更新）
    const skills = loadSkills(cfg.skillsDir);
    if (!skills.length) {
      return { result: params }; // 原样透传
    }

    const block = buildSkillsBlock(skills);
    const injected = injectSkills(params, block);

    log('info', 'skills', requestId, `附加 ${skills.length} 个 skill`);
    return { result: injected };
  }

  function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (client) client.close(1000, 'agent shutdown');
    process.exit(code);
  }

  process.on('SIGINT', () => {
    log('info', '收到 SIGINT，退出');
    shutdown(0);
  });
  process.on('SIGTERM', () => {
    log('info', '收到 SIGTERM，退出');
    shutdown(0);
  });

  attach();
}

main();
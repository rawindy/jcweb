/**
 * 市政工程检测业务系统 — 守护程序
 * 持久化运行前后端服务，崩溃自动重启
 *
 * 用法：node daemon.js
 * 停止：Ctrl+C（两次间隔 < 1s 强制退出）
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;

// ========== 服务定义 ==========
const services = [
  {
    name: 'backend',
    dir: path.join(ROOT, 'backend'),
    cmd: 'npm',
    args: ['run', 'dev'],
    color: '\x1b[36m', // cyan
  },
  {
    name: 'frontend',
    dir: path.join(ROOT, 'frontend'),
    cmd: 'npm',
    args: ['run', 'dev'],
    color: '\x1b[35m', // magenta
  },
];

// ========== 重启控制 ==========
const RESTART_DELAY = 3000;          // 最小重启间隔 ms
const RESTART_WINDOW = 30_000;       // 滑动窗口 ms
const MAX_RESTARTS_IN_WINDOW = 5;    // 窗口内最大重启次数（超过则放弃）

// ========== 启动服务 ==========
const children = new Map();           // name -> ChildProcess
const restartLog = new Map();         // name -> [timestamp, ...]

function log(name, msg) {
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`\x1b[90m[${now}]\x1b[0m [${name}] ${msg}`);
}

function startService(svc) {
  const { name, dir, cmd, args, color } = svc;

  log(name, `${color}正在启动...\x1b[0m`);

  const child = spawn(cmd, args, {
    cwd: dir,
    stdio: 'pipe',
    shell: true,
    // 传递环境变量，确保 Windows 上颜色正常
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  children.set(name, child);

  child.stdout.on('data', (data) => {
    process.stdout.write(`${color}[${name}]\x1b[0m ${data}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`\x1b[31m[${name}]\x1b[0m ${data}`);
  });

  child.on('exit', (code, signal) => {
    children.delete(name);
    const reason = signal ? `信号 ${signal}` : `退出码 ${code}`;
    log(name, `\x1b[33m进程退出 (${reason})\x1b[0m`);
    maybeRestart(svc);
  });

  child.on('error', (err) => {
    children.delete(name);
    log(name, `\x1b[31m启动失败: ${err.message}\x1b[0m`);
    maybeRestart(svc);
  });
}

function maybeRestart(svc) {
  // 检查滑动窗口内重启次数
  const now = Date.now();
  const log = restartLog.get(svc.name) || [];
  // 清理窗口外的记录
  const recent = log.filter(t => now - t < RESTART_WINDOW);
  recent.push(now);
  restartLog.set(svc.name, recent);

  if (recent.length > MAX_RESTARTS_IN_WINDOW) {
    console.error(
      `\x1b[31m[${svc.name}] ${RESTART_WINDOW / 1000}s 内重启 ${recent.length} 次，超过上限 ${MAX_RESTARTS_IN_WINDOW}，放弃重启。请检查服务状态。\x1b[0m`
    );
    return;
  }

  // 延迟重启（避免 CPU 空转）
  setTimeout(() => {
    if (!shuttingDown) {
      startService(svc);
    }
  }, RESTART_DELAY);
}

// ========== 优雅退出 ==========
let shuttingDown = false;
let lastCtrlC = 0;

function shutdown() {
  const now = Date.now();
  if (now - lastCtrlC < 1000) {
    console.log('\n\x1b[31m强制退出\x1b[0m');
    process.exit(1);
  }
  lastCtrlC = now;

  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n\x1b[33m正在关闭所有服务...（再按一次 Ctrl+C 强制退出）\x1b[0m');

  for (const [name, child] of children) {
    log(name, '发送 SIGTERM...');
    if (process.platform === 'win32') {
      // Windows 上 SIGTERM 有时不生效，用 taskkill
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }

  // 2 秒后强制退出
  setTimeout(() => {
    console.log('\x1b[31m超时，强制退出\x1b[0m');
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ========== 启动 ==========
console.log('\x1b[1m\x1b[32m╔══════════════════════════════════════╗\x1b[0m');
console.log('\x1b[1m\x1b[32m║  市政工程检测业务系统 — 守护程序    ║\x1b[0m');
console.log('\x1b[1m\x1b[32m╚══════════════════════════════════════╝\x1b[0m');
console.log('');
console.log('\x1b[90m  按 Ctrl+C 退出（连按两次强制退出）\x1b[0m');
console.log('');

for (const svc of services) {
  startService(svc);
}

/**
 * 启用仓库自带的 git 钩子（`.githooks/`）。
 *
 * 为什么需要这个脚本，而不是在 `package.json` 里写一行
 * `git config core.hooksPath .githooks || true`：
 *
 * 1. **`core.hooksPath` 存在 `.git/config`，那是不进版本控制的本地文件。**
 *    别人 clone 之后没有这道闸门 —— 而 `pre-push` 拦的正是「把过期 bundle
 *    或不一致的 inject 声明推上去」这类事故。装了就要真的装上。
 * 2. **`|| true` 会把失败静默吞掉**：不在 git 目录里、`git` 不存在、权限不足，
 *    三种情况都是"没启用"，但用户看到的是"install 成功"，于是以为有保护。
 *    静默失效的防线比没有防线更危险 —— 这次事故本身就是"静默失效"的形状。
 * 3. `pnpm install --ignore-scripts` 时本脚本不会跑，所以要**同时**在
 *    `.githooks/README.md` 与 README 里写清手动启用方式，并且有 CI 兜底
 *    （`.github/workflows/verify.yml` 做同样的三项检查，不依赖任何本地配置）。
 *
 * 设计取舍：**不在失败时让 install 失败**。装不上钩子不该阻断开发者的安装流程，
 * 但必须留下显眼的警告；真正的硬闸在 CI。
 *
 * @module dsh-opendesign-usage/scripts/enable-hooks
 */
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_DIR = '.githooks';
const PRE_PUSH = join(root, HOOKS_DIR, 'pre-push');

/** 打印一条明显的警告（而不是普通 console.log，它容易被 npm 输出淹没）。 */
function warn(lines) {
  const bar = '─'.repeat(72);
  console.warn(`\n${bar}\n⚠️  dsh-opendesign-usage：git 钩子未启用\n${bar}`);
  for (const line of lines) console.warn(line);
  console.warn(`${bar}\n`);
}

/** 静默执行 git，返回 stdout；失败返回 undefined。 */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

// 1. 不是 git 仓库（例如从 npm tarball 安装）：什么都不做，这是正常情况。
if (git(['rev-parse', '--git-dir']) === undefined) {
  process.exit(0);
}

// 1b. ⚠️⚠️ 只有「本包目录就是仓库根」时才允许动 core.hooksPath。
//
// 被当成依赖装进**别人**的仓库时，`git rev-parse` 会一路向上找到宿主仓库的 `.git`，
// 于是 `git config core.hooksPath .githooks` 改的是**宿主的配置**。
// 实测后果（2026-10-15，/tmp 沙箱复现）：
//   宿主原本 core.hooksPath = .my-own-hooks
//   → 被改成 .githooks，而宿主目录下**没有** .githooks
//   → git 对不存在的 hooksPath 目录是"静默忽略其中所有钩子"
//   → **宿主仓库的全部钩子被关闭**（husky / lefthook 之类一起废掉）
//   而本脚本还打印"已启用"、退出 0。
//
// 这比"自己仓库的闸门没装上"严重得多：破坏面是别人的仓库、且完全无声。
// 所以这一步不是优化，是安全边界 —— 不属于自己的仓库，一个字节都不改。
// ⚠️ 已知取舍（这些都实测过，不是没想到）：
//   · 本包目录是**指向仓库外**的符号链接时 → 判为"依赖"，跳过。这是**正确**的：
//     那种布局下本包确实不属于该仓库。
//   · 同仓库内的符号链接（如 pnpm workspace link 到 packages/xxx）→ 也会被跳过，
//     属于**误判**。但误判方向是安全的（只是"没自动启用"，绝不"改了别人的配置"），
//     且真实安装路径（`pnpm install` 从 node_modules 跑 prepare）走硬链接副本、
//     不是符号链接；CI 也做同样三项检查。因此刻意不为它放宽判断 ——
//     放宽的代价是可能误改别人的仓库，方向错了。
//   · git worktree → 判为自己仓库、正常启用；但 `git config` 默认写**共享配置**
//     （`<主仓库>/.git/config`），所以 worktree 里的设置会同时影响主仓库。
//     同一仓库内可接受，记录在此以免日后被当成 bug 排查。
let repoRoot;
try {
  repoRoot = realpathSync(git(['rev-parse', '--show-toplevel']) ?? '');
} catch {
  process.exit(0);
}
if (repoRoot !== realpathSync(root)) {
  console.log(
    `[dsh-opendesign-usage] 本包是 ${repoRoot} 的依赖，跳过 git 钩子设置（不动宿主的 core.hooksPath）。`,
  );
  process.exit(0);
}

// 2. 钩子文件必须存在，否则"启用"是空话。
if (!existsSync(PRE_PUSH)) {
  warn([
    `找不到 ${HOOKS_DIR}/pre-push —— 无法启用推送前的检查。`,
    '如果你是从 tarball 安装的，可以忽略；如果是 clone 的仓库，说明文件缺失。',
  ]);
  process.exit(0);
}

// 3. 钩子必须可执行。`git clone` 后执行位通常保留，但从压缩包解出时会丢。
try {
  const mode = statSync(PRE_PUSH).mode;
  // 只要 owner / group / other 任一有执行位就算可执行（0o111）。
  if ((mode & 0o111) === 0) {
    execFileSync('chmod', ['+x', PRE_PUSH], { cwd: root, stdio: 'ignore' });
  }
} catch {
  // chmod 失败不致命：git 会用 sh 显式执行钩子，多数情况下仍可运行。
}

// 4. 真正启用 —— 但**绝不覆盖**已有配置。
//
// 实测（2026-10-15）：仓库已有 `core.hooksPath = .husky` 时，无条件写入会把
// 用户的 husky 顶掉，且对方毫不知情。用户的钩子配置不是我们该动的东西，
// 所以这里只在"本来就指向本目录"或"完全没有配置"时才写。
const existing = git(['config', 'core.hooksPath']);
if (existing === HOOKS_DIR) {
  console.log(`[dsh-opendesign-usage] git 钩子已启用（${HOOKS_DIR}）。`);
  process.exit(0);
}
if (existing !== undefined && existing !== '') {
  warn([
    `本仓库的 core.hooksPath 已经是 "${existing}"，**没有**被改成 ${HOOKS_DIR}。`,
    '覆盖它会顶掉你现有的钩子（husky / lefthook 等），所以这里只提醒、不自动改。',
    '',
    `要手动接入：把 ${HOOKS_DIR}/pre-push 链进现有钩子目录，`,
    `或在确认不需要现有钩子后执行 git config core.hooksPath ${HOOKS_DIR}。`,
    '',
    '即使不启用，CI 也会做同样三项检查（.github/workflows/verify.yml）。',
  ]);
  process.exit(0);
}
const set = git(['config', 'core.hooksPath', HOOKS_DIR]);
if (set !== undefined) {
  console.log(`[dsh-opendesign-usage] git 钩子已启用（core.hooksPath = ${HOOKS_DIR}）。`);
  process.exit(0);
}

// 5. 设置失败：出声，但不阻断安装（硬闸在 CI）。
warn([
  '设置 core.hooksPath 失败，推送前的自动检查**不会生效**。',
  '',
  '请手动执行一次：',
  `    git config core.hooksPath ${HOOKS_DIR}`,
  '',
  '推送前的检查会重建 bundle、跑全量测试、并断言产物与 src 同源。',
  '即使没启用，CI 也会做同样的三项检查（.github/workflows/verify.yml）。',
]);

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

//bin.ts 顶层即执行 CLI 全流程，退出码只能从子进程观察；CLI 失败路径不触发 Redis 连接（懒实例化）
const binEntry = path.join(import.meta.dirname, '../src/bin.ts');
const demoProject = path.join(import.meta.dirname, '_demo_project');

test('CLI exits 0 when listing available commands', () => {
  const result = spawnSync(process.execPath, [binEntry], {
    cwd: demoProject,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});

test('CLI exits 1 when a command fails', () => {
  const result = spawnSync(process.execPath, [binEntry, 'unknown:command'], {
    cwd: demoProject,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
});

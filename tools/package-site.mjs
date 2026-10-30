#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageSite } from '../lib/publish.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log('用法：node tools/package-site.mjs [--out 空输出目录]（默认 .pages/）');
} else {
  try {
    let out;
    if (args.length === 2 && args[0] === '--out' && args[1]) out = resolve(args[1]);
    else if (args.length === 1 && args[0].startsWith('--out=') && args[0].slice(6)) out = resolve(args[0].slice(6));
    else if (args.length) throw new Error('参数无效；使用 --out 指定空输出目录');
    const result = packageSite(root, out);
    console.log(`已打包 ${result.files.length} 个公开文件到 ${result.directory}`);
  } catch (error) {
    console.error(`静态发布打包失败：${error.message}`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
// Focused regression checks for this static site, not a general-purpose HTML or secret scanner.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|colon|Tab|NewLine);|&#(?:x[0-9a-f]+|\d+);/gi, entity => {
  if (entity[1] === '#') {
    const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  }
  return { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&colon;': ':', '&tab;': '\t', '&newline;': '\n' }[entity.toLowerCase()];
});
const elements = html => [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([a-z][a-z0-9:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)].map(match => {
  const attributes = [...match[2].matchAll(/(?:^|\s)([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(value => [value[1].toLowerCase(), decode(value[2] ?? value[3] ?? value[4] ?? '')]);
  return { name: match[1].toLowerCase(), attrs: Object.fromEntries(attributes), attributes, index: match.index };
});
const digest = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const integrity = bytes => `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
const relative = value => value && !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(value) && !value.includes('\\');
const same = (a, b) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

export function inspectHtml(html, { page, baseUrl, scriptBytes, styleBytes }) {
  const errors = [], tags = elements(html), documentUrl = new URL(page, baseUrl);
  const fail = rule => errors.push(`${page}: ${rule}`);
  let documentBase = documentUrl;
  const base = tags.find(tag => tag.name === 'base');
  if (base) {
    try {
      documentBase = new URL(base.attrs.href, documentUrl);
      if (documentBase.origin !== documentUrl.origin) fail('base 必须保持本站来源');
    } catch { fail('base 地址无效'); }
  }
  const asset = (value, file, bytes) => {
    if (!relative(value)) return false;
    try {
      const actual = new URL(value, documentBase), expected = new URL(file, baseUrl);
      return actual.origin === expected.origin && actual.pathname === expected.pathname && !actual.hash && actual.search === `?v=${digest(bytes)}`;
    } catch { return false; }
  };
  for (const tag of tags) {
    if (['iframe', 'object', 'embed'].includes(tag.name)) fail(`禁止活动嵌入元素 ${tag.name}`);
    if (new Set(tag.attributes.map(([name]) => name)).size !== tag.attributes.length) fail(`${tag.name} 存在重复属性`);
    for (const [name, value] of tag.attributes) {
      if (/^on[a-z]+$/i.test(name)) fail(`禁止内联事件属性 ${name}`);
      if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name) && /^(?:javascript|vbscript|data):/i.test(value.replace(/[\u0000-\u0020\u007f-\u009f]/g, ''))) fail(`${name} 使用危险 URL 协议`);
    }
    if (tag.name === 'a' && tag.attrs.target === '_blank' && !/(?:^|\s)noopener(?:\s|$)/.test(tag.attrs.rel || '')) fail('新窗口链接缺少 noopener');
    if (tag.name === 'form') {
      try { if (new URL(tag.attrs.action || '', documentBase).origin !== documentUrl.origin) fail('表单不得提交到第三方'); }
      catch { fail('表单 action 无效'); }
    }
    if (tag.name === 'meta' && tag.attrs['http-equiv']?.toLowerCase() === 'refresh') fail('禁止 meta refresh 跳转');
  }
  const scripts = tags.filter(tag => tag.name === 'script');
  if (scripts.length !== 1 || !asset(scripts[0]?.attrs.src, 'assets/app.js', scriptBytes)) fail('必须仅加载带正确内容版本的本站 app.js');
  if (scripts.some(tag => tag.attrs.integrity !== integrity(scriptBytes))) fail('app.js SRI 必须匹配实际脚本内容');
  if (/<script\b[^>]*>[\s\S]*?\S[\s\S]*?<\/script\s*>/i.test(html.replace(/<script\b[^>]*>\s*<\/script\s*>/gi, ''))) fail('禁止内联脚本内容');
  const styles = tags.filter(tag => tag.name === 'link' && (tag.attrs.rel || '').toLowerCase().split(/\s+/).includes('stylesheet'));
  if (styles.length !== 1 || !asset(styles[0]?.attrs.href, 'assets/site.css', styleBytes)) fail('必须仅加载带正确内容版本的本站 site.css');
  if (tags.some(tag => tag.name === 'style')) fail('禁止内联 style 元素，地图定位仅允许 style 属性');
  for (const tag of tags.filter(tag => tag.name === 'link' && /^(?:preconnect|dns-prefetch|preload|modulepreload|prefetch)$/i.test(tag.attrs.rel || ''))) {
    try { if (new URL(tag.attrs.href, documentBase).origin !== documentUrl.origin) fail('禁止第三方预连接或预加载'); }
    catch { fail('资源提示地址无效'); }
  }

  const policies = tags.filter(tag => tag.name === 'meta' && tag.attrs['http-equiv']?.toLowerCase() === 'content-security-policy');
  if (policies.length !== 1) fail('必须存在且仅存在一个 CSP meta');
  else {
    const rules = policies[0].attrs.content.split(';').map(value => value.trim().split(/\s+/)).filter(([name]) => name);
    if (new Set(rules.map(([name]) => name.toLowerCase())).size !== rules.length) fail('CSP 存在重复指令');
    const policy = Object.fromEntries(rules.map(([name, ...values]) => [name.toLowerCase(), values]));
    const required = { 'default-src': ["'none'"], 'script-src': [`'${integrity(scriptBytes)}'`], 'script-src-attr': ["'none'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'"], 'connect-src': ["'none'"], 'object-src': ["'none'"], 'base-uri': ["'self'"], 'form-action': ["'self'"], 'frame-src': ["'none'"] };
    for (const [name, values] of Object.entries(required)) if (!same(policy[name] || [], values)) fail(`CSP ${name} 未按最小权限设置`);
    if (policy['script-src-elem'] && !same(policy['script-src-elem'], required['script-src'])) fail('CSP script-src-elem 不得放宽脚本限制');
    if (policy['style-src-elem'] && !same(policy['style-src-elem'], ["'self'"]) && !same(policy['style-src-elem'], required['style-src'])) fail('CSP style-src-elem 不得放宽样式来源');
    for (const name of ['worker-src', 'font-src', 'manifest-src']) if (policy[name] && !same(policy[name], ["'none'"])) fail(`CSP ${name} 不得开放资源`);
    if (policy['report-uri'] || policy['report-to']) fail('未配置外部 CSP 遥测端点');
    if ([...scripts, ...styles, ...(base ? [base] : [])].some(tag => tag.index < policies[0].index)) fail('CSP 必须位于所有活动资源及 base 之前');
  }
  const referrers = tags.filter(tag => tag.name === 'meta' && tag.attrs.name?.toLowerCase() === 'referrer');
  if (referrers.length !== 1 || referrers[0].attrs.content !== 'strict-origin-when-cross-origin') fail('缺少限制跨站来源信息的 referrer policy');
  return errors;
}

export function inspectClientScript(source, file = 'assets/app.js') {
  const errors = [];
  const rules = {
    '禁止 HTML 字符串写入': /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\s*\.\s*(?:write|writeln)\s*\(/,
    '禁止动态代码执行': /\beval\s*\(|\b(?:new\s+)?Function\s*\(/,
    '禁止客户端网络请求': /\bfetch\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/,
  };
  for (const [rule, pattern] of Object.entries(rules)) if (pattern.test(source)) errors.push(`${file}: ${rule}`);
  return errors;
}

const secretRules = [
  ['GitHub personal token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{70,}\b/g],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['API secret key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['npm authentication token', /(?:_authToken|npmAuthToken)\s*[:=]\s*["']?(?!\$\{|\$[A-Za-z_]|<)[A-Za-z0-9_-]{24,}/g],
];
export function scanSecretText(text, file) {
  return secretRules.flatMap(([rule, pattern]) => [...text.matchAll(pattern)].map(match => ({ file, rule, line: text.slice(0, match.index).split('\n').length })));
}
export function sensitiveFilename(file) {
  const name = basename(file).toLowerCase();
  return /^\.env(?:\.(?!example$|sample$|template$).+)?$/.test(name) || /\.(?:pem|p12|pfx|key)$/.test(name) || /^(?:credentials(?:\.json)?|secrets\.json|id_rsa|id_ed25519|id_ecdsa)$/.test(name);
}

export function checkSecurity(root) {
  const errors = [], config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
  const dates = readdirSync(join(root, 'content')).filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).map(file => file.slice(0, -5));
  const pages = ['index.html', 'map/index.html', 'archive/index.html', 'about/index.html', 'sources/index.html', 'subscribe/index.html', '404.html', ...dates.flatMap(date => [`${date}/index.html`, `${date}/map/index.html`])];
  const scriptBytes = readFileSync(join(root, 'assets/app.js')), styleBytes = readFileSync(join(root, 'assets/site.css'));
  for (const page of pages) {
    if (!existsSync(join(root, page))) { errors.push(`${page}: 缺少发布页面`); continue; }
    errors.push(...inspectHtml(readFileSync(join(root, page), 'utf8'), { page, baseUrl: config.baseUrl, scriptBytes, styleBytes }));
  }
  errors.push(...inspectClientScript(scriptBytes.toString('utf8')));
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  let scannedTextFiles = 0;
  for (const file of new Set(files)) {
    if (sensitiveFilename(file)) errors.push(`${file}: 禁止提交潜在私密配置或密钥文件`);
    if (existsSync(join(root, file)) && lstatSync(join(root, file)).isSymbolicLink()) { errors.push(`${file}: 发布源不得包含符号链接`); continue; }
    if (/\.(?:png|jpe?g|gif|webp|ico|zip|woff2?|ttf|otf|pdf)$/i.test(extname(file)) || !existsSync(join(root, file))) continue;
    const bytes = readFileSync(join(root, file));
    if (bytes.includes(0)) continue;
    scannedTextFiles++;
    for (const hit of scanSecretText(bytes.toString('utf8'), file)) errors.push(`${hit.file}:${hit.line}: 疑似 ${hit.rule}（值已隐藏）`);
  }
  return { pages: pages.length, scannedTextFiles, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--root')) throw new Error('用法：node tools/security-check.mjs [--root <目录>]');
  const root = args.length ? resolve(args[1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const result = checkSecurity(root);
  console.log(`安全回归：${result.pages} 个 HTML，${result.scannedTextFiles} 个版本控制文本文件。`);
  if (result.errors.length) {
    console.error(result.errors.map(error => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else console.log('通过：CSP/SRI、资源边界、注入回归、外链与高置信秘密检查。此结果不替代账号、DNS、历史秘密或独立渗透测试。');
}

import path from 'node:path';

export function relativeUrl(fromFile, target = '') {
  const [pathname, hash = ''] = target.split('#');
  if (!pathname) return hash ? `#${hash}` : './';
  const targetPath = pathname.replace(/^\//, '');
  let relative = path.posix.relative(path.posix.dirname(fromFile), targetPath) || '.';
  if (targetPath.endsWith('/') && !relative.endsWith('/')) relative += '/';
  return relative + (hash ? `#${hash}` : '');
}

export function absoluteUrl(config, target = '') {
  return new URL(target, config.baseUrl).href;
}

// Reject URL-parser repairs and credential syntax before any link reaches HTML.
// Valid source URLs are returned unchanged; publication never rewrites attribution.
export function validateExternalUrl(value, field = 'URL') {
  if (typeof value !== 'string' || /[\s\u0000-\u001f\u007f-\u009f\\]/u.test(value)) {
    throw new Error(`${field}：URL 不得包含原始空白、控制字符或反斜杠`);
  }
  const authority = value.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i)?.[1];
  if (!authority || authority.includes('@')) throw new Error(`${field}：只允许不带用户名或密码的完整 http/https URL`);
  let url;
  try { url = new URL(value); }
  catch { throw new Error(`${field}：需要完整有效的 http/https URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error(`${field}：只允许不带用户名或密码的完整 http/https URL`);
  }
  return value;
}

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const escapeXml = escapeHtml;

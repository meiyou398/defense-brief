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

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const escapeXml = escapeHtml;

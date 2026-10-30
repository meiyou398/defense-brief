import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const commonPages = ['index.html', 'map/index.html', 'archive/index.html', 'about/index.html', 'sources/index.html', 'subscribe/index.html', '404.html'];
const assets = ['assets/site.css', 'assets/app.js', 'assets/map-h.svg', 'assets/favicon.svg', 'assets/og-card.png'];
const metadata = ['feed.xml', 'sitemap.xml', 'robots.txt', '.nojekyll'];
const inside = (root, target) => target === root || (!relative(root, target).startsWith(`..${sep}`) && relative(root, target) !== '..' && !isAbsolute(relative(root, target)));
const maybeStat = path => {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

function sourceRoot(root) {
  const absolute = resolve(root);
  const stat = lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`发布源必须是非符号链接目录：${absolute}`);
  return { absolute, real: realpathSync(absolute) };
}

function checkedSource(root, file, directory = false) {
  let current = root;
  const parts = file.split('/');
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`拒绝发布符号链接：${file}`);
    if (index < parts.length - 1 || directory) {
      if (!stat.isDirectory()) throw new Error(`发布源路径需要目录：${file}`);
    } else if (!stat.isFile()) throw new Error(`发布源需要普通文件：${file}`);
  }
  const real = realpathSync(current);
  if (!inside(root, real)) throw new Error(`发布源越出仓库：${file}`);
  return real;
}

// The deployment boundary is explicit: repository files outside this list stay private.
export function publishedFiles(root) {
  const { real } = sourceRoot(root);
  const content = checkedSource(real, 'content', true);
  const dates = readdirSync(content).filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).sort().map(file => {
    checkedSource(real, `content/${file}`);
    const date = file.slice(0, -5);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`无效的发布期日：${file}`);
    return date;
  });
  if (!dates.length) throw new Error('content/ 中没有可发布的日期 JSON');
  const files = [...commonPages, ...dates.flatMap(date => [`${date}/index.html`, `${date}/map/index.html`]), ...assets, ...metadata];
  if (maybeStat(join(real, 'CNAME'))) files.push('CNAME');
  for (const file of files) checkedSource(real, file);
  return files;
}

function readSource(root, file) {
  const path = checkedSource(root, file);
  const before = lstatSync(path);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw new Error(`读取时发布源已变更：${file}`);
    if (!inside(root, realpathSync(path))) throw new Error(`发布源越出仓库：${file}`);
    return readFileSync(fd);
  } finally { closeSync(fd); }
}

function outputDirectory(root, requested) {
  const absolute = resolve(root.absolute, requested);
  // Resolve the nearest existing ancestor, including aliases, before overlap checks.
  let ancestor = absolute;
  const suffix = [];
  let stat = maybeStat(ancestor);
  while (!stat) {
    suffix.unshift(relative(dirname(ancestor), ancestor));
    ancestor = dirname(ancestor);
    stat = maybeStat(ancestor);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`输出路径需要非符号链接目录：${absolute}`);
  const output = resolve(realpathSync(ancestor), ...suffix);
  if (inside(output, root.real)) throw new Error('输出目录不得覆盖发布源或其上级目录');
  if (inside(root.real, output)) {
    const top = relative(root.real, output).split(sep)[0];
    const topPath = join(root.real, top);
    // A new output directory may live in the repository, but never inside source trees.
    if (topPath !== output) {
      const topStat = maybeStat(topPath);
      if (topStat && (topStat.isSymbolicLink() || !topStat.isDirectory() || readdirSync(topPath).length)) {
        throw new Error(`输出目录不得位于已有源目录内：${absolute}`);
      }
    }
  }
  const existing = maybeStat(output);
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || readdirSync(output).length)) throw new Error(`输出目录必须为空：${absolute}`);
  return output;
}

export function packageSite(root, out = '.pages') {
  const source = sourceRoot(root);
  const files = publishedFiles(source.real);
  // Read every permitted file before creating any output, so incomplete input fails cleanly.
  const contents = files.map(file => ({ file, data: readSource(source.real, file) }));
  const directory = outputDirectory(source, out);
  mkdirSync(directory, { recursive: true });
  for (const { file, data } of contents) {
    const target = join(directory, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data, { flag: 'wx' });
  }
  return { directory, files };
}

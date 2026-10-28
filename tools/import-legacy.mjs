#!/usr/bin/env node
// 把旧版简报页面（YYYY-MM-DD/index.html）转换成 content/YYYY-MM-DD.json。
//
// 用法：
//   node tools/import-legacy.mjs 2026-10-*/index.html     转换指定页面
//   node tools/import-legacy.mjs --force ...               覆盖已存在的 JSON
//
// 已经是新版生成器输出的页面会被跳过，所以重复运行是安全的。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const force = args.includes("--force");
const files = args.filter((a) => !a.startsWith("--"));

if (!files.length) {
  console.error("用法：node tools/import-legacy.mjs [--force] <旧版页面路径...>");
  process.exit(1);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const text = (html) => decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t]+\n/g, "\n").trim();

// 解析一个来源块：<div class="src">来源：…<br><a>…</a><br><span class="tier">可信度：…</span></div>
function parseSource(html) {
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    name: text(m[2]).replace(/\s*↗\s*$/, ""),
    url: decode(m[1]),
  }));
  const rest = text(html.replace(/<a\s[\s\S]*?<\/a>/g, ""));
  let note = "";
  let tier = "";
  for (const line of rest.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const t = line.match(/可信度[:：]\s*(.+)$/);
    if (t) {
      tier = t[1].trim();
      const before = line.slice(0, t.index).replace(/[·\s]+$/, "").trim();
      if (before) note = note || before.replace(/^来源[:：]\s*/, "");
    } else if (!note) {
      note = line.replace(/^来源[:：]\s*/, "").replace(/^[·\s]+|[·\s]+$/g, "");
    }
  }
  return { note, links, tier };
}

function parseItem(html) {
  const i = html.indexOf('<div class="src">');
  const body = i >= 0 ? html.slice(0, i) : html;
  const src = i >= 0 ? html.slice(i) : "";
  const t = text(body.replace(/<span class="num">[\s\S]*?<\/span>/, ""));
  const item = { text: t };
  if (src) {
    const s = parseSource(src);
    if (s.note) item.sourceNote = s.note;
    if (s.links.length) item.links = s.links;
    if (s.tier) item.tierText = s.tier;
  }
  return item;
}

function parsePage(html, file) {
  const body = html.slice(html.indexOf("<body"));
  const date =
    (body.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || basename(dirname(file));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${file}：找不到日期`);

  const lead = text((body.match(/<div class="lead">([\s\S]*?)<\/div>/) || [, ""])[1]);
  let coverage = "";
  let summary = lead;
  const cov = lead.match(/^覆盖[:：]?\s*([^。]*)。?\s*([\s\S]*)$/);
  if (cov) {
    coverage = cov[1].trim();
    summary = cov[2].trim();
  }
  summary = summary.replace(/^本期主线[:：]\s*/, "");

  const sections = [];
  let invest = [];
  const heads = [...body.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  heads.forEach((h, idx) => {
    const start = h.index + h[0].length;
    const end = idx + 1 < heads.length ? heads[idx + 1].index : body.search(/<div class="foot">|<\/main>/);
    const chunk = body.slice(start, end);
    const title = text(h[2]);

    if (h[1] === "invest" || title === "投资视角") {
      invest = [...chunk.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
      return;
    }
    let items;
    if (chunk.includes('<div class="item">')) {
      items = chunk.split('<div class="item">').slice(1).map(parseItem);
    } else {
      items = [...chunk.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => parseItem(m[1]));
    }
    // 同一期里重复出现的战区（例如 10-17 合并了两轮）并到一起
    const same = sections.find((s) => s.title === title);
    if (same) same.items.push(...items);
    else sections.push({ title, items });
  });

  const out = { date };
  if (coverage) out.coverage = coverage;
  if (summary) out.summary = summary;
  out.sections = sections;
  if (invest.length) out.invest = invest;
  return out;
}

mkdirSync(join(ROOT, "content"), { recursive: true });
let made = 0;
for (const file of files) {
  const html = readFileSync(file, "utf8");
  if (html.includes('name="generator" content="defense-brief-build"')) {
    console.log(`跳过 ${file}（已经是新版页面）`);
    continue;
  }
  const issue = parsePage(html, file);
  const dest = join(ROOT, "content", `${issue.date}.json`);
  if (existsSync(dest) && !force) {
    console.log(`跳过 ${file}（${issue.date}.json 已存在，加 --force 覆盖）`);
    continue;
  }
  writeFileSync(dest, JSON.stringify(issue, null, 2) + "\n");
  const n = issue.sections.reduce((s, x) => s + x.items.length, 0);
  console.log(`✓ ${issue.date}：${issue.sections.length} 个战区，${n} 条，投资视角 ${issue.invest?.length || 0} 条`);
  made++;
}
console.log(`完成，写入 ${made} 个文件。`);

# 防务早知道

这是一个托管在 GitHub Pages 的每日防务简报站。编辑只维护 `content/` 中的 JSON；构建脚本生成首页、每期简报、地图、往期、可信度说明、RSS 和站点地图。

正式地址：<https://dibao.news/>（GitHub Pages + Cloudflare DNS）。旧地址 <https://meiyou398.github.io/defense-brief/> 由 GitHub 自动跳转。

首次绑定 Cloudflare 域名，请按 [dibao.news 部署步骤](docs/deployment.md) 操作，先验证域名，再绑定仓库与 DNS。

## 每天发布一期

第一次使用时安装 **Node.js 20**，在仓库目录运行：

```bash
npm ci
```

仓库包含 `.nvmrc`。如果使用 nvm，可先运行 `nvm install`、`nvm use`。以后每天只需要下面三步。

### 1. 新增内容文件

将 AI 输出的 JSON 保存为 `content/YYYY-MM-DD.json`，例如：

```text
content/2026-10-28.json
```

文件里的 `date` 必须与文件名一致。可以参考 `content/2026-10-27.json` 的完整样例，字段定义在 `data/schema.json`。正文只写普通文字，不写 HTML。不要直接修改根目录下生成的 HTML，下次构建会重新生成它们。

最小内容示例：

```json
{
  "date": "2026-10-28",
  "coverage": "10月27日上午至10月28日上午（UTC+8）",
  "summary": "本期主线摘要。",
  "sections": [
    {
      "title": "俄乌 / 欧洲",
      "items": [
        {
          "text": "本条要闻的完整正文。",
          "sourceNote": "来源说明",
          "links": [{ "name": "来源名称", "url": "https://example.com/news" }],
          "tierText": "二档专业解读"
        }
      ]
    }
  ],
  "invest": ["根据本期公开信息整理的投资视角。"]
}
```

### 2. 构建并预览

```bash
npm run build
npm test
npm run verify
```

`npm run build` 会按日期自动选出最新一期，更新首页和所有往期页面。出现校验错误时，按终端中的文件名和字段路径修正 JSON，再重新运行。`verify` 检查链接、锚点、页面结构及文件体积。

用仓库自带的 Node 静态服务器预览，不需要额外安装工具：

```bash
npm run preview
```

打开 <http://127.0.0.1:4173/defense-brief/>，检查首页、当天条目、地图和来源链接。这个命令等同于 `node tools/serve.mjs`，会模拟正式站点的 `/defense-brief/` 前缀。按 `Ctrl+C` 停止服务器。

### 3. 提交并发布

先检查改动，确认新增 JSON 和生成页面都在提交中：

```bash
git status --short
git diff --stat
git add .
git commit -m "发布 2026-10-28 防务早知道"
git push origin main
```

以上发布命令应在 `main` 分支使用。如果在其他分支编辑，先通过 Pull Request 合并到 `main`。

GitHub 仓库的 **Settings → Pages** 保持 **Deploy from a branch → main → /(root)**。推送成功后，等待 Pages 部署完成，再查看正式网址。必须一起提交生成的 HTML、`feed.xml` 和 `sitemap.xml`；Pages 不会替编辑运行 Node 构建。根目录的 `.nojekyll` 需要保留。

## 内容字段与兜底

条目编号由构建脚本按正文出现顺序从 1 开始生成，跨战区连续。`highlights.item`、`stats.item`、`featured` 和 `related` 都引用这个编号。改动条目顺序后要一起复核这些引用。

| 字段 | 建议填写 | 缺失时的显示 |
| --- | --- | --- |
| `publishedAt` | 带时区的发稿时间，如 `2026-10-28T08:00:00+08:00` | 当天 08:00 UTC+8；城市时钟由 IANA 时区自动换算 |
| `summary` | 本期主线，用于分享描述和 RSS | 第一条正文前 120 字 |
| `highlights` | 最多 6 条 `{lead, text, item}`；要点 2–6 字、短句尽量不超过 40 字 | 前 6 条的标题 |
| `stats` | 最多 5 个 `{value, unit, label, item}`，说明尽量不超过 12 字 | 隐藏“今日数字” |
| `featured` | 最值得展开读的 2 个编号 | 前 2 个主分档为一档的条目 |
| `headline` | 标题尽量不超过 28 字 | 正文首个逗号或句号前的文字，过长截断 |
| `entities` | 正文中原样出现的人名、机构、装备和地名 | 不额外加粗；填写后只加粗各实体第一次出现 |
| `whyItMatters`、`caution`、`related` | 重要性、核实提醒和关联编号 | 隐藏相应段落 |
| `domain` | `sea`、`air`、`land`、`space`、`missile`、`industry`、`diplomacy` | 显示“其他”；无需往 JSON 写 `other` |
| `location` | `{name, lat, lon}`；美国本土写 `{name, offMap:"us"}`；不确定写 `null` | 归入“未定位” |
| `invest` | 每条一段，只依据正文整理 | 隐藏投资视角 |

`value` 使用字符串，例如 `"6.94"`、`"<10"`。数字、实体和地点必须来自正文，不要补造事实。Schema 的正式长度上限略宽于编辑建议，例如标题最多 32 字，短句最多 60 字；仍建议按较短长度撰写，保证手机阅读效果。

战区名称、短名、城市时区、可信度说明和站点正式地址放在 `site.config.json`。同一期重复出现的战区会合并显示，条目编号保持原出现顺序；未知战区保留原名。现有 2026-10-17 至 2026-10-28 共 12 期；旧期已补充地图坐标与领域，未能确定的位置继续保留未定位。新增字段仍可缺省。

## 可信度怎么填写

优先保留来源原有的 `tierText`：

- 一档：政府、军方、议会、企业正式发布等一手事实。
- 二档：有明确信源的专业报道与解读。
- 三档：有立场的评论或利益相关方说法。
- 四档：仅线索、未证实。

可以写 `"一档事实（议会报告）+ 二档专业解读"`。未填写 `tier` 时，最先出现的分档是主分档；`1档` 等数字写法也可识别。首页统计按主分档计数，不把混合条目重复累计。确有需要时，可用数值 `tier: 1` 至 `tier: 4` 明确覆盖主分档。无法解析分档的条目不显示可信度标签，地图用实线框样式。

## 如果拿到的还是旧版 HTML

将旧页面另存到仓库中，例如 `legacy/2026-10-28/index.html`，然后运行：

```bash
node tools/import-legacy.mjs legacy/2026-10-28/index.html
npm run build
```

导入脚本默认不覆盖已有 JSON。确认需要覆盖时加 `--force`。生成器输出的页面带有 `defense-brief-build` 标记，导入脚本会跳过，避免将新页面误导入。

## 页面与维护

| 地址 | 内容 |
| --- | --- |
| `/` | 最新一期 |
| `/YYYY-MM-DD/` | 指定期简报；`#full` 为完整版，`#n09` 定位第 9 条 |
| `/map/`、`/YYYY-MM-DD/map/` | 最新一期或指定期地图 |
| `/archive/` | 按月往期列表与全文搜索 |
| `/about/` | 可信度定义、来源原则和免责声明 |
| `/sources/` | 16 类、136 条公开信源目录 |
| `/subscribe/` | 邮件订阅占位说明与 RSS 链接 |
| `/feed.xml`、`/sitemap.xml` | RSS 与搜索引擎站点地图 |

页面中的内部导航和资源地址使用相对路径，适配 GitHub Pages 的 `/defense-brief/` 子路径。正式地址、canonical、RSS 和 sitemap 根据 `site.config.json` 中的 `baseUrl` 生成。

404 页另设一个从 `baseUrl` 派生的站点根 `base`，保证访问任意深度的错误地址时，样式和“返回首页”仍能正确加载；页面里的导航和资源地址依然是相对路径。若迁移站点，修改 `baseUrl` 后重新构建即可。

浏览器脚本只负责阅读模式、地图与筛选、搜索的显示切换；禁用 JavaScript 仍能阅读全部正文。邮件订阅目前没有后端，可以直接使用 RSS 阅读器订阅。地图坐标在构建期计算，浏览器不下载地图计算库。

仅在需要更新底图时运行 `npm run map`。上线使用 110m 精度底图，不替换成设计稿的 50m 大文件。`npm run verify` 是静态检查，不替代浏览器交互测试、截图比对或 Lighthouse 实测。

本次改版的逐项检查、截图与实测指标见 [交付验收记录](docs/acceptance.md)。

## 地图与旧发布任务

已定位条目按同一投影生成位置，相距过近的标记显示 `+N`。选择分组后，可逐条切换并阅读全文。城市和国家级示意位置不代表装备、战斗或设施的精确地点；10 月 28 日补充依据见 [地图数据说明](docs/map-data-provenance.md)。

## 自动发布（每天 9:30 简报流程）

旧的 HTML 生成器已停用，不再向仓库写页面。每日流程改由仓库外的 `/workspace/military/wechat/publish.sh <日期>` 完成（Grok Bot 盒子上）：

1. `build.py <日期>` 只用于生成微信群纯文本 `<日期>.txt`（旧 `site/` 输出保留在本地，不再推送）。
2. 在本仓库的工作副本 `/tmp/db`（不存在时自动 clone）`git pull --ff-only`。
3. `md2json.py /tmp/db <日期>`：把 `daily/<日期>.md` 的中文部分转为 `content/<日期>.json`（战区、正文、来源、链接、可信度、投资视角；领域和地图位置按关键词自动猜测，名称带「（示意）」）。已存在的 JSON 不覆盖，人工补充的 highlights/stats/地图不会被冲掉。
4. `md2json.py /tmp/db --sources`：把 `wechat/sources.json` 同步为 `data/sources.json`。
5. `npm ci`（首次）→ `npm run build` → `npm test` → `npm run verify`，任何一步失败都不推送。
6. 普通 `git push`（绝不 force-push），然后轮询 `<baseUrl><日期>/` 直到 200。

信源目录以 `wechat/sources.json` 为准，`data/sources.json` 由脚本生成，不要手改。

## 域名切换

站点地址只由 `site.config.json` 的 `baseUrl` 一行决定：

- `https://dibao.news/`（当前）：根路径部署，构建自动生成内容为 `dibao.news` 的 `CNAME`，verify 检查 CNAME 与 baseUrl 一致。
- `https://meiyou398.github.io/defense-brief/`：子路径部署；构建前须删除仓库里的 `CNAME`（build 会报错提醒），并在 Settings → Pages 清空 Custom domain。

改完 `baseUrl` 后运行一次 `npm run build && npm test && npm run verify` 并提交生成文件。Cloudflare DNS 与 GitHub Pages 设置见 [部署步骤](docs/deployment.md)。

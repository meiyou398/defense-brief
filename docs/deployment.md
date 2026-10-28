# dibao.news 首次部署

目标主地址：**https://dibao.news/**。托管继续使用 GitHub Pages；Cloudflare 管理域名与 DNS。`www.dibao.news` 由 GitHub Pages 自动跳转到主地址。不需要购买服务器，也不需要创建 Cloudflare Pages 项目。

2026-10-28：新版已发布至 main，`baseUrl` 已设为 `https://dibao.news/` 并生成 CNAME；DNS 记录与 HTTPS 状态以 Cloudflare 和 Settings → Pages 为准。

## 1. 确认域名已激活

在 Cloudflare 控制台确认 `dibao.news` 的注册订单完成、域名状态为 Active。2026-10-28 首次查询公共 DNS 仍返回 NXDOMAIN；这可能是新注册尚未生效，需要以控制台状态和后续 DNS 查询为准。

## 2. 先验证域名所有权

打开 [GitHub 个人设置 → Pages](https://github.com/settings/pages)，不是仓库设置。选择 Add a domain，输入 `dibao.news`。将 GitHub 实际提供的 TXT 名称和验证码填入 Cloudflare → dibao.news → DNS → Records。名称通常是 `_github-pages-challenge-meiyou398`，值必须复制 GitHub 当前提供的内容。

保存后回 GitHub 点 Verify。验证通过后保留 TXT 记录。[GitHub 官方验证说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)

## 3. 发布新版并绑定域名

先确认新版验收记录中列出的限制，再合并发布分支至 `main`。旧版每天写 HTML 的发布任务必须同时改为先保存 `content/YYYY-MM-DD.json`，运行构建后再提交生成文件；否则旧任务下一次运行会覆盖新版首页。该任务位于仓库外，仓库代码不能替代其配置修改。

仓库 [Settings → Pages](https://github.com/meiyou398/defense-brief/settings/pages) 保持 **Deploy from a branch → main → /(root)**。在 Custom domain 填 `dibao.news` 并保存，然后再配置下一节的 DNS。GitHub 可能自动提交 CNAME，发布前需拉取该提交。

生成器的正式域名配置为 `site.config.json` 中：

```json
"baseUrl": "https://dibao.news/"
```

注意末尾 `/`，不要保留 `/defense-brief/`。执行 `npm run build` 后会生成内容为 `dibao.news` 的根目录 `CNAME`，并同步更新 canonical、RSS、sitemap、robots 和 404 路径。域名切换版与 CNAME 必须一起提交到 main；本地不能只改 CNAME。

使用 Node.js 20，发布前运行：

```bash
npm ci
npm run build
npm test
npm run verify
```

在发布分支提交上述源码、JSON、CNAME 与生成文件，通过 Pull Request 合并到 main。不要强制推送 main。等待仓库 Actions 中 Pages 部署成功。

## 4. 填 Cloudflare DNS

在 Cloudflare → dibao.news → DNS → Records 添加下面五条，TTL 选 Auto。A 和 CNAME 的 Proxy status 初期都设为 **DNS only（灰云）**，使 GitHub 的域名检查直接看到 Pages 地址。

| 类型 | Name | Content | Proxy status |
| --- | --- | --- | --- |
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| CNAME | `www` | `meiyou398.github.io` | DNS only |

CNAME 内容只填主机名，不填 `https://` 或 `/defense-brief/`。如果 `@` 或 `www` 已有停放记录，核对后替换冲突项；保留邮件 MX、邮件 TXT 和上一步的验证 TXT。[GitHub 官方 DNS 配置](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

灰云表示 Cloudflare 只解析 DNS，HTTPS 请求直接到 GitHub；它仍由 GitHub 提供证书。以后是否启用代理可另行决定。[Cloudflare 代理状态说明](https://developers.cloudflare.com/dns/proxy-status/)

## 5. 等待 HTTPS 并检查

回仓库 Settings → Pages，等待 DNS check successful 和证书可用，再启用 **Enforce HTTPS**。DNS 与证书可能需要最多 24 小时。

检查这些地址和行为：

- `https://dibao.news/` 显示最新一期；`https://www.dibao.news/` 跳转主地址。
- `/2026-10-27/#n09` 定位正文；`/2026-10-17/map/` 显示往期地图分组。
- `/archive/` 搜索、`/sources/` 136 条信源、`/feed.xml` 与 `/sitemap.xml` 正常。
- 任意不存在的深路径返回 404，样式和返回首页可用。
- 页面 canonical 和 feed 链接使用 `https://dibao.news/`；不再含仓库路径。

可在终端检查：

```bash
dig dibao.news A +short
dig www.dibao.news CNAME +short
curl -I https://dibao.news/
curl -I https://www.dibao.news/
```

正式网络和字体加载需上线后另测；本地 Lighthouse 不代表线上性能。

## 回退

若只需回退页面，回退发布提交并重新部署，保留已生效的域名配置。若要恢复 github.io 地址，则先在 Pages 移除 Custom domain，再把 baseUrl 改回 `https://meiyou398.github.io/defense-brief/`，明确移除 CNAME 并重新构建；同步撤掉或改正指向旧 Pages 的网站 DNS。验证 TXT 可保留。

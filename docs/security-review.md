# 安全检查与加固（2026-10-30）

结论：本站是无登录、无上传、无数据库的公开信息静态站，攻击面较小。本轮修复输入边界、增加浏览器执行限制和发布门禁。没有网站可以保证绝对安全；这些措施也不能代替账号保护、外部日更机器安全或独立渗透测试。

## 实际检查

- HTTPS已强制启用，HTTP实测301转向HTTPS；当前从GitHub Pages直接响应，Cloudflare只作为已知的DNS管理平台，未擅自改DNS或代理。
- `npm audit` 查询官方漏洞库：当前锁定依赖已知漏洞0。当前工作树高置信密钥模式检查未发现命中；检查不覆盖完整Git历史或仓库外机器。
- 14期409个正文来源URL和136个目录来源URL全部通过新校验且未改写；没有发现本次输入中已经出现恶意注入。
- GitHub秘密扫描和推送保护原本已开启；已启用漏洞提醒及Dependabot安全修复PR，修复不会自动合并。
- 已启用 main 的 `Protect main history` 规则，禁止删除与非快进强制覆盖；未要求所有日更都转为人工PR，普通更新仍可推送。[规则](https://github.com/meiyou398/defense-brief/rules/26179794)
- 账号接口未返回GitHub双因素状态，不能据此宣称已经开启；Cloudflare账号、域名注册锁、续费及DNSSEC状态未取得。

## 代码与浏览器防护

信源目录之前未经过整体校验，异常分档可进入HTML类名，危险协议也可能进入链接。本轮增加目录结构/档位/锚点/URL校验，并让标签组件只接受整数1–4。正文和目录共用HTTP(S)外链校验，拒绝凭据、控制字符和解析混淆；所有编辑文本仍按HTML上下文转义。

全部35个页面在任何资源或base之前提供CSP：默认拒绝资源，仅允许具有指定SHA-256/SRI的本地app.js执行，禁止内联脚本、事件处理、远程连接、插件和frame/worker。地图仍需要style属性，故仅样式保留unsafe-inline，样式表元素仍限本站。Referrer策略限制向第三方发送完整路径和查询。此方式符合[CSP的哈希脚本规则](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src)。

本地预览只提供与正式发布相同的公开白名单，拒绝Git元数据、源码、点文件、节点依赖和内容JSON；校验真实路径、符号链接、Host及请求方法，防止目录逃逸和DNS重绑定。监听仍限定127.0.0.1。

## 发布门禁

`.github/workflows/site.yml` 在PR、main更新及手动运行时检查。只有main的验证成功后才允许部署；发布前再次确认构建提交仍是当前main，过期任务不会覆盖新版本。失败保留上次已成功的网站。此门禁必须以 Settings → Pages → Source 为GitHub Actions且工作流实际成功为生效条件，不能只看仓库里存在YAML。

验证任务仅有contents:read；发布任务才有Pages写权限和短期OIDC，不保存个人访问令牌。官方Actions固定到核验过的提交。CI使用Node24.22.1 LTS，按lockfile安装并关闭install scripts，依次执行构建、测试、静态检查、安全检查、已知依赖漏洞检查，再打包。

45个白名单文件构成实际发布产物，源码、JSON、文档、测试、node_modules和Git目录不进入站点。仓库本身仍公开，这不是将仓库变私有。日更仍可保存JSON并普通推送，CI会从当前源码重新生成；仓库外publish.sh/md2json.py及其令牌未取得，不能声称已加固该机器。

## 验证证据

- 58项自动测试通过：包含危险链接、异常档位、HTML转义、恶意标记检测、符号链接、路径逃逸、Host/方法限制和仅公开文件打包。
- 35个HTML、1,590个内部资源/链接静态检查通过；安全检查对CSP、SRI、资产版本、客户端危险sink及高置信秘密执行回归。
- 经用户同意，使用本机临时无头Chromium，仅访问隔离本地预览，未使用浏览器账号资料。10项实际浏览器检查通过：[记录](qa/security/browser-checks.json)。内联注入、事件代码及外发请求被CSP拒绝，篡改脚本被SRI拒绝。
- 地图选择/筛选、搜索、阅读模式、目录锚点、深路径404与390px页面均通过；真正禁用JavaScript的浏览器仍显示完整正文。
- [桌面截图](qa/security/desktop.png)、[手机截图](qa/security/mobile.png)。未执行真实手机、多浏览器或第三方渗透测试。

## 仍需账号持有人完成

GitHub与Cloudflare开启通行密钥或双因素认证、保管恢复码；复核授权应用与外部日更令牌，避免长期使用权限过大的令牌；确认域名自动续费、注册锁与DNSSEC状态。

线上当前未提供HSTS、nosniff或防嵌入响应头。GitHub Pages仓库中的meta不能代替这些响应头；尤其frame-ancestors在meta中无效。若后续启用Cloudflare代理，可通过[响应头规则](https://developers.cloudflare.com/rules/transform/response-header-modification/)增加以下设置，并实测HTTPS与缓存后再启用：

| 响应头 | 建议值 |
| --- | --- |
| Content-Security-Policy | `frame-ancestors 'none'`（作为补充策略；不要在Cloudflare写死每次变化的脚本hash） |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| Strict-Transport-Security | HTTPS与证书稳定后先短期试行；不盲目启用includeSubDomains/preload |

Cloudflare尚未接入的响应头不能计为已上线。迁移代理或账号安全设置应由账号持有人参与，不能用本站代码的通过结果代替。

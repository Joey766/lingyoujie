# 另有解

「所谓失败，谁说了算？」正式文本社区。原始 HTML 原型保存在上级目录，仍可独立打开。

## 本地运行

需要 Node.js 22 或更新版。首次安装从 npm 获取依赖，Windows x64 使用随开发依赖提供的 PostgreSQL，其他支持的平台使用同一个嵌入式开发包。启动器只监听本机回环地址。

```powershell
cd 'D:\失败学ai产品\web'
npm ci
npm run local
```

浏览器打开 [本地站点](http://127.0.0.1:3000)。使用形如 `name@local.test` 的邮箱注册。验证与密码重置链接写入 `web/.local/mail.ndjson`。按邮箱与 `kind` 找到对应的最新一行，打开其中的 `url`。这是本地测试收件箱，真实邮件由预览 SMTP 提供。链接带一次性凭据，请勿分享该文件。

开站稿统一放在 `content/editorial.json`。本地首页的「审阅开站内容」可查看改稿效果。运行 `npm run local -- --publish-editorial` 会把当前稿件加入本地正式广场。线上稿件更新与发布方式见 `docs/release.md`。

正式应用初始广场为空。登录后发布一篇帖子即可开始测试。Ctrl+C 关闭本地服务。账号及内容保存在 PostgreSQL。Windows 默认数据库位于系统临时目录的项目专用位置，如需长期保留，请在首次启动前将 `LOCAL_PG_DIR` 指向有写权限的固定 ASCII 路径。请保留 `.local/runtime.env`，里面有当前本地库启动所需的密码和认证密钥。此文件必须留在本机。

```powershell
npx playwright install chromium --only-shell
npm run typecheck
npm run build
npm run test:local -- --built
```

`test:local` 启动本地 PostgreSQL 和 Web 服务，先执行事务内的权限测试，再在 Chromium 使用两个隔离会话完成邮箱及社区流程。`--built` 使用已构建版本。为了保持日常本地库的内容，可在运行测试前用 `LOCAL_PG_DIR` 指定一个独立的测试目录，并用 `LOCAL_DB_PORT`、`LOCAL_WEB_PORT` 指定空闲端口。测试创建的浏览器账号均使用专用的 `@local.test` 地址。

最终本地验收通过生产构建、PostgreSQL 权限测试和 1440 px／390 px 浏览器测试。两个浏览器会话完成邮箱验证、用户名冲突检测、登录与退出、密码重置、登录限流、发帖、评论与回复、刷新持久性、通知、越权拦截、举报及管理员隐藏。邮件链接由本地测试收件箱提供。外部邮箱送达和受保护的预览入口待授权后验收。

本地需要查看管理员队列时，先注册并验证自己的测试账号，然后在网站运行期间另开一个终端执行：

```powershell
node scripts/admin.mjs --local operator@local.test
```

此命令只能通过数据库所有者连接执行，网站界面无授予管理员权限的入口。

## 架构与迁移

| 位置 | 职责 |
|---|---|
| `app/`、`components/` | Next.js App Router、TypeScript、Tailwind CSS 及原型风格组件 |
| `lib/auth.ts`、`lib/mail.ts` | Better Auth、邮箱验证与重置、受邀注册、会话和认证限流 |
| `app/actions/`、`lib/db.ts` | 服务端动作从可信会话取得身份，在 PostgreSQL 事务内切换到受限角色 |
| `migrations/` | 账号与会话、话题与帖子、线程身份与评论、收藏与共鸣、通知、举报与审核记录 |
| `tests/` | PostgreSQL 权限测试和桌面／手机 Chromium 双账号测试 |

采用 Better Auth，便于在本机以同一个 PostgreSQL 实测完整认证流程。托管 PostgreSQL 可以选择 Supabase 或其他提供标准连接的服务。预览与上线可继续使用同一套认证和数据库结构。图片存储等扩展另开迁移。生产构建使用 Next.js 的 webpack 模式，以兼容当前 Windows 工作区。

`npm run db:migrate` 使用 `DATABASE_URL` 指向迁移所有者，按编号应用 SQL 并记录在 `lyj_migrations`，每份迁移单独提交。托管数据库需要支持创建和切换运行角色。连接前先确认目标数据库，预览和生产使用独立库。预览应用只配置 `AUTH_DATABASE_URL` 与 `COMMUNITY_DATABASE_URL`，不要给运行应用配置迁移所有者凭证。两个 LOGIN 角色由所有者安全创建，密码通过提供方秘密配置或交互式工具设置。

```sql
create role lyj_auth_app login noinherit;
grant usage on schema public to lyj_auth_app;
grant select, insert, update, delete
on table public."user", public.session, public.account, public.verification, public."rateLimit", public.auth_attempt
to lyj_auth_app;

create role lyj_community_app login noinherit;
grant lyj_runtime to lyj_community_app;
```

匿名作者映射存在私有表中，公共视图排除账号 ID、邮箱、用户名和个人主页链接。匿名评论标识按帖子分配。收藏和通知按当前会话隔离。管理员只能审核举报，公开内容可隐藏，处理留痕。普通账号拥有的数据写入通过受控函数实施，数据库还检查邮箱已验证、内容所有权及目标状态。

## 受限预览与上线检查

1. 预览需要授权的托管 PostgreSQL、可访问专用项目的部署账号和 SMTP 发信服务。先启用部署平台身份保护和预览专用域名，再设 `REGISTRATION_MODE=invite` 和 `REGISTRATION_EMAILS`。若所用方案只保护临时预览域或不支持目标保护范围，将应用停留在本地，直至有合适的受保护入口。
2. 从 `.env.example` 配置独立的 HTTPS 地址、凭证和秘密。数据库使用服务商支持的 TLS 和证书校验。外部邮箱验证、重置、会话撤销与两账号权限须在预览重新测试。接入可信代理 IP 头前应实测代理覆盖来访值。请确认 API 网关不公开数据库内部表并重新检查角色权限。
3. 上线前实测数据库备份恢复、邮件送达、代理限流和压测，完善登录与举报风控、告警监控、依赖更新、账号注销与数据保留流程。明确社区规则、举报处理与申诉流程、隐私条款和维护责任。
4. 图片、故事后续、同题讨论、私聊保留在原型中。建议在核心社区验收后先加图片和后续更新，私聊等有资源处理骚扰和滥用再加入。

扩展可沿用帖子 UUID。图片单独维护附件顺序并校验帖子归属。后续更新保留作者权限和原帖匿名范围。同题讨论引用公开帖子 ID。私聊独立建模请求、授权、会话与举报；匿名会话需要独立身份范围，默认不接受匿名联系请求。

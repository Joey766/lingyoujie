# 另有解发布手册

## 当前正式版

- 公网地址为 [lingyoujie.vercel.app](https://lingyoujie.vercel.app/)。Vercel 使用 Hobby，数据库 `lingyoujie-db` 使用 Neon Free，验证邮件由 Brevo 专用 SMTP 密钥发送。正式环境使用 `REGISTRATION_MODE=public`，完成邮箱验证后即可登录、发帖和评论。
- 2026-11-25 已验收真实邮件送达、邮箱验证、登录和发帖，并撤下临时测试帖。公开发布后，以未登录访客确认注册表单可见、首页和帖子可读。7 个主题共发布 28 篇编辑部帖子和 56 条明确标注的示例评论。
- 公网首页和帖子已允许索引，[站点地图](https://lingyoujie.vercel.app/sitemap.xml)包含 28 篇帖子。注册页及个人功能页继续使用 `noindex`。搜索收录进度由搜索引擎决定。
- 生产环境只配置受限数据库角色。迁移连接从 Neon 集成的 Development 环境保存到本机忽略目录，生产环境和部署包均不包含它。

## 改开站稿

正文、标题和示例评论集中在 `content/editorial.json`。改字时保留所属主题、`slug` 和评论顺序。它们决定帖子的固定地址和示例评论的对应关系。本地可先看「审阅开站内容」，再运行：

```powershell
npm run local -- --publish-editorial
```

同步会新增缺少的稿件，并更新同一篇稿件的文字。帖子地址、真实回复、收藏、共鸣、审核状态和首次发布时间会保留。同一版本可以重试。隐藏或撤下旧稿请走管理流程，删除源文件中的某稿不会删除已经发布的帖子。

稿件的 `exampleDates` 记录编辑部帖子和示例评论使用的日期，页面上标为「示例日期」。普通内容更新会保留已发布稿件的日期。若明确要应用新的示例日期，运行 `npm run update:content -- --sync-example-dates`。

## 第一次上线

- 只开放浏览时使用 `REGISTRATION_MODE=closed`。配置发信后可先用 `invite` 验证一封实际邮件和一次发帖，再切换为 `public`。
- 使用用户控制的 Vercel 项目、另有解专用 PostgreSQL，以及用于验证和密码重置的 SMTP 发件服务。域名可以先使用 Vercel 分配的地址。
- 在受控终端把目标库的迁移所有者连接设为 `DATABASE_URL`，核对数据库项目后运行 `npm run db:migrate`、`npm run db:publish-editorial`。用 [README](../README.md) 中的 SQL 创建账户认证和社区访问各自的运行角色。
- 在 Vercel 的 Production 环境配置 `AUTH_DATABASE_URL`、`COMMUNITY_DATABASE_URL`、`BETTER_AUTH_SECRET` 和 SMTP 参数。使用 Vercel 正式域名时自动读取生产地址，使用自定义地址时设置 `APP_URL`。测试时用 `REGISTRATION_EMAILS` 指定授权收件邮箱。运行凭证存为 Vercel Secret，迁移所有者连接只用于维护终端。
- 公开前检查首页和七个主题、编辑部署名与示例评论、受邀注册和真实验邮、普通账号发帖回复、权限和管理员访问。确认测试过的候选部署与实际要上线的版本一致。

## 后续更新

纯改文案时，修改 `content/editorial.json`，然后在 `web` 目录运行一条命令。该操作直接更新线上稿件。

```powershell
npm run update:content
```

页面或功能改动先用 `npm run local` 在本机验收，再用 `npm run release:site` 发布已关联的项目。公开页面收录由生产环境的 `PUBLIC_INDEXING=1` 控制。公开注册使用 `REGISTRATION_MODE=public`，需要完成 SMTP 发信配置与收件验证。事务邮件默认每日最多 100 封，每个收件地址间隔至少 60 秒，控制项为 `MAIL_DAILY_LIMIT`。

# 服务器端部署指南：Supervisor 后台运行

本文按当前服务器约定编写：

- 项目路径：`/root/projects/sms-platform`
- 本地监听：`127.0.0.1:2760`
- 后台保活：Supervisor
- Nginx：由你自行配置反向代理
- 运行用户：不创建专属用户，直接使用服务器当前 root 环境部署

Nginx 只需要把公网域名反代到：

```text
http://127.0.0.1:2760
```

手机端最终通过你的 HTTPS 域名调用：

```text
POST https://你的域名/api/messages/ingest
```

## 1. 准备服务器

以下命令以 root 身份执行。先安装基础依赖：

```bash
apt update
apt install -y git nginx sqlite3 curl ca-certificates supervisor
```

安装 Node.js，并确认版本：

```bash
node -v
npm -v
```

本项目当前依赖的 Next.js 要求 `node >=20.9.0`。建议使用 Node.js 22 LTS
或更高版本。

确认 Node 可执行文件路径，后面 Supervisor 配置会用到：

```bash
which node
```

如果输出不是 `/usr/bin/node`，后面的 Supervisor 配置里要替换成你的实际路径。

## 2. 获取项目代码

创建项目目录：

```bash
mkdir -p /root/projects
```

首次部署时克隆代码，把 `<你的仓库地址>` 换成实际 Git 地址：

```bash
git clone <你的仓库地址> /root/projects/sms-platform
cd /root/projects/sms-platform
npm ci
```

如果你是手动上传代码，也要保证最终代码目录是：

```text
/root/projects/sms-platform
```

上传后进入项目目录执行：

```bash
cd /root/projects/sms-platform
npm ci
```

## 3. 配置环境变量

在项目目录创建 `.env`：

```bash
cd /root/projects/sms-platform
cp .env.example .env
nano .env
```

推荐生产配置：

```bash
DATABASE_URL="file:/root/projects/sms-platform/prisma/prod.db"
SMS_INGEST_TOKEN="换成一段足够长的手机端推送密钥"
WEB_ACCESS_KEY="换成一段足够长的网页访问密钥"
KIMI_API_KEY="换成 Moonshot/Kimi API Key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="kimi-k2.6"
KIMI_TIMEOUT_MS="8000"
NODE_ENV="production"
PORT="2760"
```

字段说明：

- `DATABASE_URL`：SQLite 数据库位置。这里固定到项目的 `prisma/prod.db`。
- `SMS_INGEST_TOKEN`：手机端推送短信时使用的 Bearer Token。
- `WEB_ACCESS_KEY`：网页首次进入收件箱时输入的访问密钥。
- `KIMI_API_KEY`：短信分类调用 Kimi 的密钥。
- `KIMI_BASE_URL`：Kimi OpenAI-compatible API 地址。
- `KIMI_MODEL`：分类模型名。
- `KIMI_TIMEOUT_MS`：AI 分类超时时间，单位毫秒。
- `PORT`：本地端口，固定为 `2760`。

生成强随机密钥：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

`.env` 包含敏感信息，不要提交到 Git。手机端只需要公网地址和
`SMS_INGEST_TOKEN`。

## 4. 初始化数据库并构建项目

```bash
cd /root/projects/sms-platform
npm run db:generate
npm run db:push
npm run build
```

确认数据库文件存在：

```bash
ls -lh /root/projects/sms-platform/prisma/prod.db
```

可以先手动启动一次，确认本地端口可访问：

```bash
cd /root/projects/sms-platform
node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 2760
```

另开一个 SSH 窗口测试：

```bash
curl -I http://127.0.0.1:2760
```

确认有 HTTP 响应后，回到启动窗口按 `Ctrl+C` 停掉，继续配置 Supervisor。

## 5. 配置 Supervisor

创建 Supervisor 配置：

```bash
nano /etc/supervisor/conf.d/sms-platform.conf
```

写入以下内容。如果 `which node` 输出不是 `/usr/bin/node`，请替换 `command`
里的 Node 路径：

```ini
[program:sms-platform]
directory=/root/projects/sms-platform
command=/usr/bin/node /root/projects/sms-platform/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 2760
autostart=true
autorestart=true
startsecs=5
stopsignal=INT
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/sms-platform.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=10
environment=NODE_ENV="production",PORT="2760"
```

加载配置并启动：

```bash
supervisorctl reread
supervisorctl update
supervisorctl status sms-platform
```

常用命令：

```bash
supervisorctl start sms-platform
supervisorctl stop sms-platform
supervisorctl restart sms-platform
supervisorctl tail -f sms-platform
```

确认服务已监听本地端口：

```bash
curl -I http://127.0.0.1:2760
```

## 6. Nginx 反向代理要点

Nginx 由你自行配置，核心目标是把公网域名反代到：

```nginx
proxy_pass http://127.0.0.1:2760;
```

建议保留这些请求头：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

生产环境建议使用 HTTPS。浏览器通知和生产环境安全 Cookie 都需要 HTTPS。

配置完成后检查：

```bash
nginx -t
systemctl reload nginx
curl -I https://你的域名
```

不要对公网开放 `2760` 端口。`2760` 只应该被本机 Nginx 访问。

## 7. 手机端推送格式

手机端推送到：

```text
POST https://你的域名/api/messages/ingest
```

请求头：

```http
Authorization: Bearer <SMS_INGEST_TOKEN>
Content-Type: application/json
```

请求体：

```json
{
  "receivedPhoneNumber": "+8613800000000",
  "deviceName": "Redmi 1",
  "simSlot": 1,
  "sender": "955xx",
  "body": "您的验证码是 123456，请勿泄露",
  "receivedAt": "2026-05-30T08:30:00.000Z"
}
```

必填字段：

- `receivedPhoneNumber`：收到短信的手机号。
- `sender`：短信发送方。
- `body`：短信正文。
- `receivedAt`：手机端收到短信的时间，建议使用 ISO 8601 UTC 时间。

可选字段：

- `deviceName`：手机名称，用于网页展示来源。
- `simSlot`：SIM 卡槽编号。

服务器会自动分类，手机端不需要提交分类。重复推送同一条短信时，请保持
`receivedPhoneNumber + sender + body + receivedAt` 不变，这样服务器会识别为重复数据。

用 curl 测试：

```bash
curl -X POST "https://你的域名/api/messages/ingest" \
  -H "Authorization: Bearer <SMS_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "receivedPhoneNumber": "+8613800000000",
    "deviceName": "Redmi 1",
    "simSlot": 1,
    "sender": "955xx",
    "body": "您的验证码是 123456，请勿泄露",
    "receivedAt": "2026-05-30T08:30:00.000Z"
  }'
```

首次写入成功返回 `201`，重复推送返回 `200` 且响应里会有 `duplicate: true`。

## 8. 网页访问

浏览器打开：

```text
https://你的域名
```

输入 `WEB_ACCESS_KEY` 后进入收件箱。网页会自动拉取最新短信；浏览器验证码通知
需要在 HTTPS 下授权通知权限。

## 9. 日常更新

更新代码前，建议先备份数据库：

```bash
mkdir -p /root/backups/sms-platform
sqlite3 /root/projects/sms-platform/prisma/prod.db \
  ".backup '/root/backups/sms-platform/prod-$(date +%F-%H%M%S).db'"
```

更新代码并重启：

```bash
cd /root/projects/sms-platform
git pull --ff-only
npm ci
npm run db:generate
npm run db:push
npm run build
supervisorctl restart sms-platform
supervisorctl status sms-platform
```

如果只改了 `.env`：

```bash
supervisorctl restart sms-platform
```

## 10. 备份与恢复

备份：

```bash
mkdir -p /root/backups/sms-platform
sqlite3 /root/projects/sms-platform/prisma/prod.db \
  ".backup '/root/backups/sms-platform/prod-$(date +%F-%H%M%S).db'"
```

恢复前先停服务：

```bash
supervisorctl stop sms-platform
cp /root/backups/sms-platform/prod-YYYY-MM-DD-HHMMSS.db \
  /root/projects/sms-platform/prisma/prod.db
supervisorctl start sms-platform
```

## 11. 排错

服务起不来：

```bash
supervisorctl status sms-platform
supervisorctl tail -f sms-platform
tail -n 200 /var/log/supervisor/sms-platform.log
```

本地端口不通：

```bash
curl -I http://127.0.0.1:2760
```

Nginx 配置错误：

```bash
nginx -t
tail -n 100 /var/log/nginx/error.log
```

手机端返回 `401`：

- 检查请求头是否是 `Authorization: Bearer <SMS_INGEST_TOKEN>`。
- 检查手机端保存的 token 是否和服务器 `.env` 里的值完全一致。

手机端返回 `400`：

- 检查 JSON 是否合法。
- 检查是否缺少 `receivedPhoneNumber`、`sender`、`body`、`receivedAt`。
- 检查 `receivedAt` 是否是可解析的时间字符串。

短信保存了但分类都是 `other`：

- 检查 `KIMI_API_KEY` 是否正确。
- 验证码会先走本地关键词规则，未命中后才调用 Kimi。
- Kimi 失败时消息会以 `classificationSource=fallback` 保存，可用 SQLite 检查最近记录：

```bash
sqlite3 /root/projects/sms-platform/prisma/prod.db \
  "select sender, category, classificationSource, classificationError from Message order by createdAt desc limit 10;"
```

浏览器不能收到通知：

- 确认站点使用 HTTPS。
- 确认浏览器已允许该域名发送通知。
- 通知只针对验证码分类的新短信触发。

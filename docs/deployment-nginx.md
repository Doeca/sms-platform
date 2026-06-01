# 服务器端部署指南：Nginx 反向代理

本文以 Ubuntu 22.04/24.04 服务器为例，把 SMS Platform 部署为一个只监听本机
`127.0.0.1:3000` 的 Next.js 服务，并通过 Nginx 对外提供 HTTPS 访问。

## 1. 部署结构

推荐目录：

- 代码目录：`/var/www/sms-platform`
- SQLite 数据库：`/var/lib/sms-platform/prod.db`
- 环境变量文件：`/etc/sms-platform/sms-platform.env`
- systemd 服务：`sms-platform.service`
- Nginx 域名：`sms.example.com`

服务对外只有 Nginx 暴露 80/443 端口，Next.js 应用只绑定
`127.0.0.1:3000`，手机端通过 HTTPS 调用
`https://sms.example.com/api/messages/ingest` 推送短信。

## 2. 准备服务器

```bash
sudo apt update
sudo apt install -y git nginx sqlite3 curl ca-certificates
```

安装 Node.js，并确保版本满足 Next.js 要求：

```bash
node -v
```

本项目当前依赖的 Next.js 要求 `node >=20.9.0`。建议使用 Node.js 22 LTS
或更高的长期维护版本。无论使用系统包、NodeSource、nvm、fnm 还是服务器面板，
最终都要保证 `node` 和 `npm` 能在 systemd 服务里直接找到。

创建专用运行用户和目录：

```bash
sudo useradd --system --user-group --create-home --shell /usr/sbin/nologin smsapp
sudo install -d -m 755 -o root -g root /var/www
sudo install -d -m 750 -o smsapp -g smsapp /var/lib/sms-platform
sudo install -d -m 750 -o root -g smsapp /etc/sms-platform
```

## 3. 获取代码并安装依赖

把 `<你的仓库地址>` 换成实际 Git 地址：

```bash
sudo git clone <你的仓库地址> /var/www/sms-platform
sudo chown -R smsapp:smsapp /var/www/sms-platform
cd /var/www/sms-platform
sudo -u smsapp npm ci
```

如果服务器不能直接访问 Git，也可以先在本地打包代码，再上传到
`/var/www/sms-platform`。上传后仍然需要执行 `npm ci`。

## 4. 配置环境变量

创建环境变量文件：

```bash
sudo install -m 640 -o root -g smsapp /dev/null /etc/sms-platform/sms-platform.env
sudo nano /etc/sms-platform/sms-platform.env
```

写入以下内容：

```bash
DATABASE_URL="file:/var/lib/sms-platform/prod.db"
SMS_INGEST_TOKEN="换成一段足够长的手机端推送密钥"
WEB_ACCESS_KEY="换成一段足够长的网页访问密钥"
KIMI_API_KEY="换成 Moonshot/Kimi API Key"
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="kimi-k2.6"
KIMI_TIMEOUT_MS="8000"
NODE_ENV="production"
PORT="3000"
```

字段说明：

- `DATABASE_URL`：SQLite 数据库位置。生产环境建议使用绝对路径。
- `SMS_INGEST_TOKEN`：手机端推送短信时使用的 Bearer Token。
- `WEB_ACCESS_KEY`：网页首次进入收件箱时输入的访问密钥。
- `KIMI_API_KEY`：短信分类调用 Kimi 的密钥。
- `KIMI_BASE_URL`：Kimi OpenAI-compatible API 地址。
- `KIMI_MODEL`：分类模型名。
- `KIMI_TIMEOUT_MS`：AI 分类超时时间，单位毫秒。

生成两个强随机密钥的例子：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

不要把 `/etc/sms-platform/sms-platform.env` 提交到 Git，也不要发给手机端以外的人。
手机端只需要知道公网地址和 `SMS_INGEST_TOKEN`。

## 5. 初始化数据库并构建项目

生成 Prisma Client、创建 SQLite 文件并同步数据库结构：

```bash
cd /var/www/sms-platform
sudo -u smsapp bash -lc 'set -a; . /etc/sms-platform/sms-platform.env; set +a; npm run db:generate'
sudo -u smsapp bash -lc 'set -a; . /etc/sms-platform/sms-platform.env; set +a; npm run db:push'
sudo -u smsapp bash -lc 'set -a; . /etc/sms-platform/sms-platform.env; set +a; npm run build'
```

确认数据库文件存在：

```bash
sudo ls -lh /var/lib/sms-platform/prod.db
```

## 6. 配置 systemd 常驻服务

创建服务文件：

```bash
sudo nano /etc/systemd/system/sms-platform.service
```

写入：

```ini
[Unit]
Description=SMS Platform
After=network.target

[Service]
Type=simple
User=smsapp
Group=smsapp
WorkingDirectory=/var/www/sms-platform
EnvironmentFile=/etc/sms-platform/sms-platform.env
ExecStart=/usr/bin/node /var/www/sms-platform/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

如果你的 `node` 不在 `/usr/bin/node`，先确认路径：

```bash
which node
```

然后把 `ExecStart` 里的 `/usr/bin/node` 改成实际路径。

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sms-platform
sudo systemctl status sms-platform
```

查看实时日志：

```bash
sudo journalctl -u sms-platform -f
```

本机测试：

```bash
curl -I http://127.0.0.1:3000
```

能看到 HTTP 响应后，再配置 Nginx。

## 7. 配置 Nginx 反向代理

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/sms-platform
```

写入，把 `sms.example.com` 换成你的域名：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

limit_req_zone $binary_remote_addr zone=sms_ingest:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name sms.example.com;

    client_max_body_size 1m;

    location /api/messages/ingest {
        limit_req zone=sms_ingest burst=20 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 60s;
    }
}
```

启用站点并检查配置：

```bash
sudo ln -s /etc/nginx/sites-available/sms-platform /etc/nginx/sites-enabled/sms-platform
sudo nginx -t
sudo systemctl reload nginx
```

如果服务器开启了 UFW：

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
sudo ufw status
```

不要开放 3000 端口。3000 只应该被本机 Nginx 访问。

## 8. 配置 HTTPS

浏览器通知和安全 Cookie 在生产环境都需要 HTTPS。使用 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sms.example.com
```

按提示开启 HTTP 到 HTTPS 的自动跳转。完成后检查：

```bash
curl -I https://sms.example.com
```

自动续期通常由系统定时器处理，可以检查：

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

## 9. 手机端推送格式

手机端推送到：

```text
POST https://sms.example.com/api/messages/ingest
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
curl -X POST "https://sms.example.com/api/messages/ingest" \
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

## 10. 网页访问

浏览器打开：

```text
https://sms.example.com
```

输入 `WEB_ACCESS_KEY` 后进入收件箱。网页会自动拉取最新短信；浏览器验证码通知
需要在 HTTPS 下授权通知权限。

## 11. 日常更新

每次更新代码前，建议先备份数据库：

```bash
sudo install -d -m 750 -o smsapp -g smsapp /var/backups/sms-platform
sudo -u smsapp sqlite3 /var/lib/sms-platform/prod.db \
  ".backup '/var/backups/sms-platform/prod-$(date +%F-%H%M%S).db'"
```

更新代码并重启：

```bash
cd /var/www/sms-platform
sudo -u smsapp git pull --ff-only
sudo -u smsapp npm ci
sudo -u smsapp bash -lc 'set -a; . /etc/sms-platform/sms-platform.env; set +a; npm run db:generate'
sudo -u smsapp bash -lc 'set -a; . /etc/sms-platform/sms-platform.env; set +a; npm run db:push'
sudo -u smsapp bash -lc 'set -a; . /etc/sms-platform/sms-platform.env; set +a; npm run build'
sudo systemctl restart sms-platform
sudo systemctl status sms-platform
```

如果只改了环境变量：

```bash
sudo systemctl restart sms-platform
```

## 12. 备份与恢复

备份：

```bash
sudo -u smsapp sqlite3 /var/lib/sms-platform/prod.db \
  ".backup '/var/backups/sms-platform/prod-$(date +%F-%H%M%S).db'"
```

恢复前先停服务：

```bash
sudo systemctl stop sms-platform
sudo cp /var/backups/sms-platform/prod-YYYY-MM-DD-HHMMSS.db /var/lib/sms-platform/prod.db
sudo chown smsapp:smsapp /var/lib/sms-platform/prod.db
sudo systemctl start sms-platform
```

## 13. 排错

服务起不来：

```bash
sudo journalctl -u sms-platform -n 200 --no-pager
```

Nginx 配置错误：

```bash
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
```

手机端返回 `401`：

- 检查请求头是否是 `Authorization: Bearer <SMS_INGEST_TOKEN>`。
- 检查手机端保存的 token 是否和服务器环境变量完全一致。

手机端返回 `400`：

- 检查 JSON 是否合法。
- 检查是否缺少 `receivedPhoneNumber`、`sender`、`body`、`receivedAt`。
- 检查 `receivedAt` 是否是可解析的时间字符串。

短信保存了但分类都是 `other`：

- 检查 `KIMI_API_KEY` 是否正确。
- 验证码会先走本地关键词规则，未命中后才调用 Kimi。
- Kimi 失败时消息会以 `classificationSource=fallback` 保存，可用 SQLite 检查最近记录：

```bash
sudo -u smsapp sqlite3 /var/lib/sms-platform/prod.db \
  "select sender, category, classificationSource, classificationError from Message order by createdAt desc limit 10;"
```

浏览器不能收到通知：

- 确认站点使用 HTTPS。
- 确认浏览器已允许该域名发送通知。
- 通知只针对验证码分类的新短信触发。

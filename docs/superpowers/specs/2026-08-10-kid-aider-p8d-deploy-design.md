# Kid-Aider P8d · 阿里云部署 — 设计规格

> 日期：2026-08-10
> 状态：设计完成（已确认）

## 目标

将 Kid-Aider 部署到阿里云轻量服务器，通过域名 HTTPS 访问。适配 Next.js 14 Node.js 生产环境，遵循部署指南的代码/数据分离模型。

---

## 1. 部署架构

```
阿里云轻量服务器（2GB 内存，Ubuntu）
├── /opt/kid-aider/              ← 代码目录（git clone，可随意重建）
│   ├── .env                     ← 环境变量（gitignore，手动创建）
│   ├── start_prod.sh            ← systemd 启动脚本
│   └── kid-aider.service        ← systemd 服务定义（复制到 /etc/systemd/system/）
│
├── /opt/kid-aider-data/         ← 数据目录（永久保留，代码目录外）
│   ├── db/kid-aider.db          ← SQLite 数据库（WAL 模式）
│   └── backups/                 ← 自动备份
│
├── Nginx 反向代理
│   ├── :80  → 301 → :443
│   └── :443 → proxy_pass http://127.0.0.1:3000
│
└── systemd: kid-aider.service
    └── ExecStart=start_prod.sh → npm start（Next.js 生产模式，端口 3000）
```

**设计决策**：
- 数据库从 `process.cwd()/data/` **迁移到** `/opt/kid-aider-data/db/`（通过 `DATA_DIR` 环境变量控制）
- Nginx 终结 HTTPS，Next.js 只处理 HTTP（`:3000` 仅本地监听）
- SSE 聊天流通过 Nginx `proxy_buffering off` + `chunked_transfer_encoding on` 保证实时性
- 遵循部署指南的代码/数据物理隔离红线

---

## 2. 代码变更

### 2.1 数据库路径可配置化

**文件：** `lib/db/index.ts`

**之前：**
```typescript
const dbPath = path.join(process.cwd(), "data", "kid-aider.db");
```

**之后：**
```typescript
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "db", "kid-aider.db");
```

### 2.2 新增 .env.example

```bash
# Kid-Aider 环境变量配置模板
# 复制为 .env 并填入实际值

# ========== 数据目录（生产环境必设）==========
# 本地开发无需设置，默认使用项目内 data/ 目录
DATA_DIR=/opt/kid-aider-data

# ========== 服务配置 ==========
HOST=127.0.0.1
PORT=3000

# ========== AI 模型 API ==========
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxx

# ========== 应用配置 ==========
NODE_ENV=production
```

### 2.3 变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `lib/db/index.ts` | Modify | 1 行改 2 行，DATA_DIR 环境变量控制数据库路径 |
| `.env.example` | Create | 本地开发 + 服务器部署的配置模板 |
| `.gitignore` | 不变 | 已忽略 `.env`、`data/`、`*.db` |

### 2.4 不变内容

- 所有路由、组件、SSE、i18n — 零改动
- `next.config.mjs` — 无需改动
- `package.json` scripts — 无需改动
- WAL 模式、foreign_keys — 保持不变
- P1-P8c 所有功能 — 零影响

---

## 3. 服务器端部署文件

这些文件在服务器上手动创建，不提交到 Git 仓库。

### 3.1 服务管理文件

| 文件 | 位置 | 职责 |
|---|---|---|
| `kid-aider.service` | `/etc/systemd/system/` | systemd 服务定义，开机自启、崩溃重启 |
| `start_prod.sh` | `/opt/kid-aider/` | 构建 + 启动包装脚本 |
| `kid-aider.conf` | `/etc/nginx/sites-available/` | Nginx 反向代理，HTTPS 终结，SSE 透传 |
| `backup.sh` | `/opt/kid-aider/` | 数据库备份脚本（tar.gz + 7 天保留） |
| `update.sh` | `/opt/kid-aider/` | 一键更新脚本 |

### 3.2 systemd service 配置

```ini
[Unit]
Description=Kid-Aider 儿童创意启发助手
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/kid-aider
ExecStart=/opt/kid-aider/start_prod.sh
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 3.3 start_prod.sh

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

# 确保数据目录存在
if [ -f ".env" ]; then
    DATA_DIR=$(grep -oP 'DATA_DIR=\K.*' .env || echo "/opt/kid-aider-data")
    mkdir -p "$DATA_DIR/db" "$DATA_DIR/backups"
fi

# 构建并启动
export NODE_ENV=production
npm start
```

### 3.4 Nginx 配置（SSE 关键部分）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;          # SSE 核心：禁用缓冲
        proxy_cache off;
        proxy_read_timeout 300s;      # 聊天流长连接超时
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3.5 backup.sh

```bash
#!/bin/bash
DATA_DIR="/opt/kid-aider-data"
BACKUP_DIR="$DATA_DIR/backups"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" -C "$DATA_DIR" .
echo "✅ 备份完成: $BACKUP_FILE"
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

### 3.6 update.sh

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "📦 备份当前数据..."
DATA_DIR=$(grep -oP 'DATA_DIR=\K.*' .env 2>/dev/null || echo "/opt/kid-aider-data")
if [ -d "$DATA_DIR" ]; then
    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$BACKUP_NAME" -C "$DATA_DIR" . 2>/dev/null || true
    echo "   备份已保存: $BACKUP_NAME"
fi

echo "🔄 拉取最新代码..."
git pull

echo "📦 安装依赖..."
npm ci --production

echo "🔨 构建..."
npm run build

echo "🔄 重启服务..."
systemctl restart kid-aider

echo "✅ 更新完成！"
systemctl status kid-aider --no-pager -l
```

---

## 4. 环境变量

### 4.1 服务器 .env

```bash
DATA_DIR=/opt/kid-aider-data
HOST=127.0.0.1
PORT=3000
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxx
NODE_ENV=production
```

### 4.2 本地开发 vs 服务器差异

| 变量 | 本地 | 服务器 |
|---|---|---|
| `DATA_DIR` | 不设置（fallback 到 `cwd/data/`） | `/opt/kid-aider-data` |
| `NODE_ENV` | `development` | `production` |
| `HOST` | `localhost` | `127.0.0.1` |

本地开发完全不需要 `.env` 文件，现有行为不变。

---

## 5. 部署执行步骤

### Step 1 — GitHub 仓库

1. 在 yfan0422-prog 账号下创建仓库 `kid-aider`
2. 本地添加 remote 并 push：
   ```bash
   git remote add origin git@github.com:yfan0422-prog/kid-aider.git
   git push -u origin main
   ```

### Step 2 — 服务器基础环境

```bash
ssh root@<服务器IP>

# 系统工具
apt update && apt install -y git curl wget vim build-essential python3

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# GitHub SSH Key
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub  # → 添加到 https://github.com/settings/ssh/new
ssh -T git@github.com       # 验证

# npm 淘宝镜像（加速）
npm config set registry https://registry.npmmirror.com
```

### Step 3 — 项目部署

```bash
cd /opt
git clone git@github.com:yfan0422-prog/kid-aider.git
cd kid-aider

# 创建 .env（填入实际 API Key）
vim .env

npm ci --production
npm run build

# 手动验证
npm start
# 浏览器访问 http://<服务器IP>:3000/，确认可打开。Ctrl+C 停止
```

### Step 4 — 数据迁移

```bash
mkdir -p /opt/kid-aider-data/db
mkdir -p /opt/kid-aider-data/backups
# .env 中已设 DATA_DIR=/opt/kid-aider-data
```

### Step 5 — systemd 服务

```bash
cp /opt/kid-aider/kid-aider.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable kid-aider
systemctl start kid-aider
systemctl status kid-aider  # → active (running)
```

### Step 6 — Nginx + HTTPS

```bash
apt install -y nginx certbot python3-certbot-nginx

# 先配置 Nginx（仅 HTTP）
cp /opt/kid-aider/kid-aider.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/kid-aider.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 等 DNS 生效后获取证书
certbot --nginx -d your-domain.com
certbot renew --dry-run  # 验证自动续期
```

### Step 7 — 收尾

```bash
chmod +x /opt/kid-aider/backup.sh

# 定时备份（每天凌晨 2 点）
crontab -e
# 添加：0 2 * * * /opt/kid-aider/backup.sh >> /var/log/kid-aider-backup.log 2>&1

# 确认阿里云安全组已开放 80/443 端口
```

---

## 6. 风险与应对

| 风险 | 应对 |
|---|---|
| `better-sqlite3` `npm install` 失败 | 确保 `build-essential python3` 已安装（Step 2） |
| `next build` 内存不足 OOM | 2GB 够用但临界；临时 swap：`fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile` |
| 域名 DNS 未生效 | Nginx + certbot 等 DNS 生效后再做，不影响 `:3000` 直接访问验证 |
| `npm ci` 下载慢 | 淘宝镜像：`npm config set registry https://registry.npmmirror.com` |
| GitHub clone 失败（TLS 错误） | 使用 SSH 协议（`git@github.com:...`），不用 HTTPS |

---

## 7. 全局约束

- 零新增 npm 依赖（仅服务器端工具）
- 不改变路由结构
- 不改变 SSE 架构
- 不改变 P1-P8c 任何功能
- 遵循部署指南代码/数据分离红线
- TypeScript strict，无 `any`

---

## 8. 不修改

- 数据库 schema
- API 路由逻辑
- 对话引导引擎
- 内容生成引擎
- SSE 架构
- i18n 字典
- UI 组件
- MD 文档文件

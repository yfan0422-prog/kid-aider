# P8d 阿里云部署 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Kid-Aider 部署到阿里云轻量服务器（Ubuntu，2GB），通过域名 HTTPS 访问，系统级开机自启。

**Architecture:** Next.js 14 生产模式 → Nginx 反向代理（HTTPS 终结 + SSE 透传） → systemd 生命周期管理 → SQLite 数据目录在代码目录外（`/opt/kid-aider-data/`）。

**Tech Stack:** Next.js 14 + Node.js 20 + better-sqlite3 + Nginx + systemd + Let's Encrypt

## Global Constraints

- 零新增 npm 依赖
- TypeScript strict，无 `any`
- 不改变路由结构
- 不改变 SSE 架构
- 不改变 P1-P8c 任何功能
- 代码/数据物理隔离（`DATA_DIR` 环境变量）
- 所有服务器配置文件不提交到 Git 仓库（`.env`、`.service`、Nginx config 等）
- 验证：`npx tsc --noEmit` 0 errors

---

## File Map

| 文件 | 操作 | 职责 | 提交 Git? |
|---|---|---|---|
| `lib/db/index.ts` | Modify | 1 行改为 DATA_DIR 环境变量控制数据库路径 | ✅ 是 |
| `.env.example` | Create | 环境变量模板，本地开发 + 服务器部署参考 | ✅ 是 |
| `kid-aider.service` | Create | systemd 服务定义 | ❌ 服务器手动创建 |
| `start_prod.sh` | Create | 生产环境启动脚本 | ❌ 服务器手动创建 |
| `kid-aider.conf` | Create | Nginx 反向代理 + SSE 配置 | ❌ 服务器手动创建 |
| `backup.sh` | Create | 数据库自动备份脚本 | ❌ 服务器手动创建 |
| `update.sh` | Create | 一键更新脚本 | ❌ 服务器手动创建 |
| `DEVELOPMENT.md` | Modify | 更新 P8d 进度 | ✅ 是 |

---

### Task 1: 数据库路径可配置化 + .env.example

**Files:**
- Modify: `lib/db/index.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: 无
- Produces: `DATA_DIR` 环境变量读取（`getDb()` 内部使用）

- [ ] **Step 1: 修改 lib/db/index.ts**

将数据库路径从硬编码 `process.cwd()/data/` 改为通过 `DATA_DIR` 环境变量控制。

```typescript
// lib/db/index.ts — 找到这行（约第 8 行）:
const dbPath = path.join(process.cwd(), "data", "kid-aider.db");

// 替换为:
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "db", "kid-aider.db");
```

完整上下文（修改前后对比）：

```typescript
// 修改前:
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(process.cwd(), "data", "kid-aider.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  // ...

// 修改后:
export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "db", "kid-aider.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  // ...
```

行为：`DATA_DIR` 设置时使用指定目录，未设置时 fallback 到 `cwd/data/`。本地开发无需 `.env`，行为完全不变。

- [ ] **Step 2: 创建 .env.example**

```bash
# Kid-Aider 环境变量配置模板
# 复制为 .env 并填入实际值（.env 已在 .gitignore 中忽略）

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

- [ ] **Step 3: 编译验证**

```bash
npx tsc --noEmit
```

期望：0 errors。确认现有 `getDb()` 调用方不受影响（`getDb()` 签名不变）。

- [ ] **Step 4: 确认 .gitignore 覆盖**

`.gitignore` 已包含以下行（来自前序阶段）：
```
.env
.env.local
data/
*.db
```

`.env.example` 不在忽略列表中，会正常提交。

- [ ] **Step 5: Commit**

```bash
git add lib/db/index.ts .env.example
git commit -m "feat(p8d): make database path configurable via DATA_DIR env var"
```

---

### Task 2: 服务器部署文件创建

**Files:**
- Create: `kid-aider.service`
- Create: `start_prod.sh`
- Create: `kid-aider.conf`
- Create: `backup.sh`
- Create: `update.sh`

**Interfaces:**
- Consumes: `DATA_DIR` from `.env`（Task 1），`npm start`（package.json scripts）
- Produces: 5 个服务器端配置文件（不提交 Git，通过 scp 或手动创建上传到服务器）

所有文件在项目根目录创建，部署时手动复制到服务器。

- [ ] **Step 1: 创建 kid-aider.service**

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

- [ ] **Step 2: 创建 start_prod.sh**

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

# 确保数据目录存在
if [ -f ".env" ]; then
    DATA_DIR=$(grep -oP 'DATA_DIR=\K.*' .env || echo "/opt/kid-aider-data")
    mkdir -p "$DATA_DIR/db" "$DATA_DIR/backups"
fi

# 启动 Next.js 生产模式
export NODE_ENV=production
npm start
```

- [ ] **Step 3: 创建 kid-aider.conf（Nginx）**

```nginx
# Kid-Aider Nginx 反向代理配置
# 部署到: /etc/nginx/sites-available/kid-aider.conf
# 启用: ln -s /etc/nginx/sites-available/kid-aider.conf /etc/nginx/sites-enabled/

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

- [ ] **Step 4: 创建 backup.sh**

```bash
#!/bin/bash
set -e

DATA_DIR="/opt/kid-aider-data"
BACKUP_DIR="$DATA_DIR/backups"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" -C "$DATA_DIR" .
echo "✅ 备份完成: $BACKUP_FILE"

# 清理 7 天前的旧备份
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

- [ ] **Step 5: 创建 update.sh**

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

- [ ] **Step 6: 设置脚本可执行权限**

```bash
chmod +x start_prod.sh backup.sh update.sh
```

- [ ] **Step 7: Commit**

```bash
git add kid-aider.service start_prod.sh kid-aider.conf backup.sh update.sh
git commit -m "feat(p8d): add server deployment config files (systemd, nginx, scripts)"
```

---

### Task 3: GitHub 仓库推送

**依赖:** Task 1, Task 2 完成

- [ ] **Step 1: 确认当前分支干净**

```bash
git status
```

期望：`nothing to commit, working tree clean`

- [ ] **Step 2: 添加 remote 并推送**

```bash
# 添加 GitHub remote（如果尚未配置）
git remote add origin git@github.com:yfan0422-prog/kid-aider.git

# 推送 main 分支
git push -u origin main
```

- [ ] **Step 3: 验证**

浏览器访问 `https://github.com/yfan0422-prog/kid-aider` 确认代码已推送。

---

### Task 4: 服务器基础环境搭建

**依赖:** Task 3 完成（代码已在 GitHub）

> ⚠️ 此任务需要服务器 SSH 访问权限。以下命令在服务器上执行。

- [ ] **Step 1: SSH 登录服务器**

```bash
ssh root@<服务器IP>
```

- [ ] **Step 2: 系统环境检查**

```bash
cat /etc/os-release        # 确认 Ubuntu 版本
df -h                       # 磁盘空间
free -h                     # 内存（应显示 2GB）
nproc                       # CPU 核数
```

- [ ] **Step 3: 安装系统工具**

```bash
apt update
apt install -y git curl wget vim build-essential python3
```

`build-essential` 和 `python3` 是 `better-sqlite3` 的 C++ 编译依赖。

- [ ] **Step 4: 安装 Node.js 20**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 验证
node --version   # 应显示 v20.x.x
npm --version
```

- [ ] **Step 5: 配置 npm 淘宝镜像**

```bash
npm config set registry https://registry.npmmirror.com
```

加速 `npm ci` 下载。

- [ ] **Step 6: 配置 GitHub SSH Key**

```bash
# 生成密钥
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519

# 显示公钥
cat ~/.ssh/id_ed25519.pub
```

将输出的公钥添加到 GitHub：https://github.com/settings/ssh/new
选择 **Authentication Key**。

- [ ] **Step 7: 验证 GitHub 连接**

```bash
ssh -T git@github.com
```

期望：`Hi yfan0422-prog! You've successfully authenticated`

- [ ] **Step 8: 创建 swap（内存不足保险）**

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

`next build` 在 2GB 内存下可能 OOM，2GB swap 作为保险。

---

### Task 5: 项目部署 + 手动验证

**依赖:** Task 4 完成

> ⚠️ 以下命令在服务器上执行。

- [ ] **Step 1: Clone 项目**

```bash
cd /opt
git clone git@github.com:yfan0422-prog/kid-aider.git
cd kid-aider
```

- [ ] **Step 2: 创建 .env 文件**

```bash
cat > /opt/kid-aider/.env << 'EOF'
DATA_DIR=/opt/kid-aider-data
HOST=127.0.0.1
PORT=3000
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_API_KEY=sk-ant-xxx
NODE_ENV=production
EOF
```

> 🔴 将 `sk-xxx` 和 `sk-ant-xxx` 替换为实际 API Key。

- [ ] **Step 3: 创建数据目录**

```bash
mkdir -p /opt/kid-aider-data/db
mkdir -p /opt/kid-aider-data/backups
```

- [ ] **Step 4: 安装依赖 + 构建**

```bash
cd /opt/kid-aider
npm ci --production
npm run build
```

确认 `better-sqlite3` 编译成功，构建无报错。

- [ ] **Step 5: 手动启动验证**

```bash
npm start
```

输出应显示：`> kid-aider@0.1.0 start` → `> next start` → `Ready on http://localhost:3000`

- [ ] **Step 6: 本地 curl 验证**

新开终端 SSH 登录，执行：

```bash
curl -sL http://localhost:3000/ | head -20
```

期望：返回 HTML 页面（包含 `<html lang="zh-CN">` 等）。

- [ ] **Step 7: 外网访问验证**

在本地浏览器访问：`http://<服务器IP>:3000/`

期望：Kid-Aider 页面正常加载，聊天功能可用。

> 如无法访问，检查阿里云安全组是否开放了 3000 端口。

验证通过后，在服务器终端按 `Ctrl+C` 停止。

---

### Task 6: systemd + Nginx + HTTPS

**依赖:** Task 5 完成

> ⚠️ 以下命令在服务器上执行。

- [ ] **Step 1: 复制部署配置文件**

```bash
# 5 个配置文件已在 Task 2 创建，随 git clone 到服务器

# 设置脚本可执行权限
chmod +x /opt/kid-aider/start_prod.sh /opt/kid-aider/backup.sh /opt/kid-aider/update.sh
```

- [ ] **Step 2: 安装并启用 systemd 服务**

```bash
cp /opt/kid-aider/kid-aider.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable kid-aider
systemctl start kid-aider
```

- [ ] **Step 3: 验证 systemd 服务**

```bash
systemctl status kid-aider
```

期望：`active (running)`。

```bash
curl -sL http://localhost:3000/ | head -5
```

期望：正常返回 HTML。

- [ ] **Step 4: 安装 Nginx + Let's Encrypt**

```bash
apt install -y nginx certbot python3-certbot-nginx
```

- [ ] **Step 5: 配置 Nginx**

```bash
cp /opt/kid-aider/kid-aider.conf /etc/nginx/sites-available/kid-aider.conf
ln -s /etc/nginx/sites-available/kid-aider.conf /etc/nginx/sites-enabled/
```

- [ ] **Step 6: 替换 Nginx 配置中的域名占位符**

将 `kid-aider.conf` 中的 `your-domain.com` 替换为实际域名：

```bash
sed -i 's/your-domain.com/<你的实际域名>/g' /etc/nginx/sites-available/kid-aider.conf
```

- [ ] **Step 7: 测试并重载 Nginx**

```bash
nginx -t
systemctl reload nginx
```

此时 HTTP (:80) 应该可以访问（重定向到 HTTPS 的规则暂时不生效 — certbot 会处理）。

- [ ] **Step 8: 获取 HTTPS 证书**

> 确保域名 DNS 已解析到服务器 IP。

```bash
certbot --nginx -d <你的域名>
```

按提示输入邮箱，同意条款。

- [ ] **Step 9: 验证 HTTPS**

浏览器访问 `https://<你的域名>/`

期望：页面正常加载，浏览器显示锁图标。

- [ ] **Step 10: 验证证书自动续期**

```bash
certbot renew --dry-run
```

期望：无报错。

---

### Task 7: 备份 + 收尾

**依赖:** Task 6 完成

> ⚠️ 以下命令在服务器上执行。

- [ ] **Step 1: 配置定时备份**

```bash
# 测试备份脚本
/opt/kid-aider/backup.sh
ls -la /opt/kid-aider-data/backups/
```

期望：生成 `backup_YYYYMMDD_HHMMSS.tar.gz` 文件。

- [ ] **Step 2: 添加 crontab 定时任务**

```bash
crontab -e
```

添加行：

```
0 2 * * * /opt/kid-aider/backup.sh >> /var/log/kid-aider-backup.log 2>&1
```

每天凌晨 2 点自动备份，保留 7 天。

- [ ] **Step 3: 验证 update.sh**

```bash
# 如果本地有新提交需要测试更新流程：
cd /opt/kid-aider
./update.sh
```

- [ ] **Step 4: 确认阿里云安全组**

登录阿里云控制台 → 轻量应用服务器 → 防火墙 → 确认规则：

| 端口 | 协议 | 状态 |
|------|------|------|
| 22 | TCP | ✅ |
| 80 | TCP | ✅ |
| 443 | TCP | ✅ |

可以移除测试用的 3000 端口规则（现在通过 Nginx 反向代理访问）。

- [ ] **Step 5: 重启验证（最终测试）**

```bash
reboot
```

等待 1-2 分钟，重新 SSH 登录后：

```bash
systemctl status kid-aider   # → active (running)
curl -sL http://localhost:3000/ | head -5  # → HTML
```

浏览器访问 `https://<你的域名>/` → 正常加载。

- [ ] **Step 6: 更新 DEVELOPMENT.md**

```markdown
## P8d · 阿里云部署（完成：2026-08-10）
- [x] Task 1: 数据库路径可配置化 + .env.example
- [x] Task 2: 服务器部署文件（systemd + Nginx + 脚本）
- [x] Task 3: GitHub 仓库推送
- [x] Task 4: 服务器基础环境搭建
- [x] Task 5: 项目部署 + 手动验证
- [x] Task 6: systemd + Nginx + HTTPS
- [x] Task 7: 备份 + 收尾
```

同时更新进度条：添加 `P8d ██████████ 100%`。

---

## Post-Deployment Checklist

- [ ] 服务器可通过 SSH 登录
- [ ] GitHub SSH Key 已配置，`ssh -T git@github.com` 成功
- [ ] 代码已 clone 到 `/opt/kid-aider/`
- [ ] 数据目录已创建在 `/opt/kid-aider-data/`（代码目录外）
- [ ] `.env` 已创建，`DATA_DIR=/opt/kid-aider-data`
- [ ] `npm ci --production && npm run build` 成功
- [ ] `kid-aider.service` 已安装到 systemd，`active (running)`
- [ ] Nginx 反向代理配置正确（SSE `proxy_buffering off`）
- [ ] HTTPS 证书已获取，自动续期配置正确
- [ ] 阿里云安全组已开放 80/443 端口（关闭 3000）
- [ ] `https://<域名>/` 外网可正常访问
- [ ] 聊天 SSE 流正常工作
- [ ] `backup.sh` 手动执行成功
- [ ] crontab 定时备份已配置
- [ ] 重启后服务自动启动
- [ ] `npx tsc --noEmit` 0 errors（本地）

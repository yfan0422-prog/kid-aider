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
npm install

echo "🔨 构建..."
npm run build

echo "🔄 重启服务..."
systemctl restart kid-aider

echo "✅ 更新完成！"
systemctl status kid-aider --no-pager -l

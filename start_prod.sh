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

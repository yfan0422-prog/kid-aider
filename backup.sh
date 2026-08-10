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

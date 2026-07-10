#!/bin/sh
# ==============================================================================
# 🚀 FamilyTimeFlow — NAS 一键部署脚本 (WebDAV)
#
# 支持多网络环境：
#   1. 内网 (192.168.x.x)
#   2. 外网 zconnect.cn
#   3. Tailscale IP (100.x.x.x)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_PATH="family-time-flow"

# 加载 ~/.nas-env 本地共享配置
[ -f ~/.nas-env ] && . ~/.nas-env

# 加载项目特定配置
if [ -f "${SCRIPT_DIR}/../env.local" ]; then
    . "${SCRIPT_DIR}/../env.local"
fi

NAS_USER="${NAS_USER:-user}"
WEBDAV_USER="${WEBDAV_USER:-$NAS_USER}"
NAS_IP="${NAS_IP:-192.168.6.108}"
NAS_PORT="${NAS_WEBDAV_PORT:-8889}"
DOMAIN="${DOMAIN_PUBLIC:-https://remote-access-8888.zconnect.cn}"
KEYCHAIN_WEBDAV_SERVICE="${KEYCHAIN_WEBDAV_SERVICE:-emma-webdav}"
TAILSCALE_IP="${TAILSCALE_IP:-100.102.16.75}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "============================================="
echo " 🚀 FamilyTimeFlow — NAS 部署 (WebDAV)"
echo "============================================="
echo " 项目: ${PROJECT_PATH}"

# ----- 1. 读取 WebDAV 密码 -----
PASSWORD=""
if [ "$(uname)" = "Darwin" ]; then
    PASSWORD=$(security find-generic-password -s "$KEYCHAIN_WEBDAV_SERVICE" -a "$USER" -w 2>/dev/null)
fi
if [ -z "$PASSWORD" ] && [ -n "$WEBDAV_PASS" ]; then
    PASSWORD="$WEBDAV_PASS"
fi
if [ -z "$PASSWORD" ]; then
    echo -e "${YELLOW}⚠️ 请输入 WebDAV 密码（输入时不显示）：${NC}"
    read -s PASSWORD
    echo ""
fi
if [ -z "$PASSWORD" ]; then
    echo -e "${RED}❌ 未提供 WebDAV 密码。${NC}"
    exit 1
fi
PASSWORD=$(echo "$PASSWORD" | tr -d '\r\n')

# ----- 2. 检测网络环境 -----
IS_LAN=false
if ip addr 2>/dev/null | grep -q "inet 192\.168\." || \
   ifconfig 2>/dev/null | grep -q "inet 192\.168\." || \
   hostname -I 2>/dev/null | grep -q "192\.168\."; then
    IS_LAN=true
fi

IS_TAILSCALE=false
if ip addr 2>/dev/null | grep -q "inet 100\." || \
   ifconfig 2>/dev/null | grep -q "inet 100\."; then
    IS_TAILSCALE=true
fi

# ----- 3. 配置 rclone remotes -----
OBSCURED=$(rclone obscure "$PASSWORD")
rclone config delete ftf-nas-ip 2>/dev/null || true
rclone config delete ftf-nas-ts 2>/dev/null || true
rclone config delete ftf-tailscale 2>/dev/null || true

rclone config create ftf-nas-ip webdav \
    url "http://${NAS_IP}:${NAS_PORT}" \
    vendor other user "$WEBDAV_USER" pass "$OBSCURED" > /dev/null 2>&1

rclone config create ftf-nas-ts webdav \
    url "$DOMAIN" \
    vendor other user "$WEBDAV_USER" pass "$OBSCURED" > /dev/null 2>&1

rclone config create ftf-tailscale webdav \
    url "http://${TAILSCALE_IP}:${NAS_PORT}" \
    vendor other user "$WEBDAV_USER" pass "$OBSCURED" > /dev/null 2>&1

unset OBSCURED

# ----- 4. 确定可用 remote（LAN > 外网 > Tailscale）-----
REMOTE=""
echo " 目标: ${NAS_IP}:${NAS_PORT}"

if [ "$IS_LAN" = true ]; then
    echo -e "${YELLOW}⏳ 内网环境，测试 LAN...${NC}"
    if rclone lsd ftf-nas-ip: --timeout 3s 2>/dev/null | grep -q "docker\|scripts"; then
        REMOTE="ftf-nas-ip"
        echo -e "${GREEN}✅ 内网连接成功${NC}"
    fi
fi

if [ -z "$REMOTE" ]; then
    echo -e "${YELLOW}⏳ 测试外网连接: ${DOMAIN}...${NC}"
    if rclone lsd ftf-nas-ts: --timeout 10s 2>/dev/null | grep -q "docker\|scripts"; then
        REMOTE="ftf-nas-ts"
        echo -e "${GREEN}✅ 外网连接成功${NC}"
    fi
fi

if [ -z "$REMOTE" ] && [ "$IS_TAILSCALE" = true ]; then
    echo -e "${YELLOW}⏳ 测试 Tailscale: ${TAILSCALE_IP}:${NAS_PORT}...${NC}"
    if rclone lsd ftf-tailscale: --timeout 5s 2>/dev/null | grep -q "docker\|scripts"; then
        REMOTE="ftf-tailscale"
        echo -e "${GREEN}✅ Tailscale 连接成功${NC}"
    fi
fi

if [ -z "$REMOTE" ]; then
    echo -e "${YELLOW}⏳ 尝试 Tailscale IP（直接）: ${TAILSCALE_IP}:${NAS_PORT}...${NC}"
    if rclone lsd ftf-tailscale: --timeout 5s 2>/dev/null | grep -q "docker\|scripts"; then
        REMOTE="ftf-tailscale"
        echo -e "${GREEN}✅ Tailscale 连接成功${NC}"
    fi
fi

if [ -z "$REMOTE" ]; then
    echo -e "${RED}❌ 所有连接均失败（LAN + 外网 + Tailscale）。${NC}"
    exit 1
fi

unset PASSWORD
START_TS=$(date +%s)

# ----- 5. 同步前端页面 -----
echo ""
echo -e "${YELLOW}📄 同步前端页面 (→ /docker/html/${PROJECT_PATH}/)...${NC}"
SOURCE_HTML="${SCRIPT_DIR}/../web/html/${PROJECT_PATH}"
if [ -d "$SOURCE_HTML" ]; then
    rclone sync --delete-excluded "${SOURCE_HTML}/" "${REMOTE}:/docker/html/${PROJECT_PATH}/" 2>&1 | grep -v "NOTICE" | tail -2 || true
    echo -e "${GREEN}✅ HTML 同步完成${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 ${SOURCE_HTML}，跳过${NC}"
fi

# ----- 6. 同步 nginx 配置 -----
echo ""
echo -e "${YELLOW}📄 同步 nginx 配置 (→ /docker/conf.d/${PROJECT_PATH}.conf)...${NC}"
NGINX_FRAGMENT="${SCRIPT_DIR}/../web/conf.d/${PROJECT_PATH}.conf"
if [ -f "$NGINX_FRAGMENT" ]; then
    rclone copy "$NGINX_FRAGMENT" "${REMOTE}:/docker/conf.d/" 2>&1 | grep -v "NOTICE" | tail -1 || true
    echo -e "${GREEN}✅ nginx 配置同步完成${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 ${NGINX_FRAGMENT}，跳过${NC}"
fi

# ----- 7. 同步后端代码 -----
echo ""
echo -e "${YELLOW}📄 同步后端代码 (→ /docker/backend/${PROJECT_PATH}/)...${NC}"
SOURCE_BACKEND="${SCRIPT_DIR}/../web/backend/${PROJECT_PATH}"
if [ -d "$SOURCE_BACKEND" ]; then
    rclone sync --delete-excluded "${SOURCE_BACKEND}/" "${REMOTE}:/docker/backend/${PROJECT_PATH}/" --exclude "node_modules" --exclude "data/" 2>&1 | grep -v "NOTICE" | tail -2 || true
    echo -e "${GREEN}✅ 后端同步完成${NC}"
else
    echo -e "${YELLOW}⚠️  未找到 ${SOURCE_BACKEND}，跳过${NC}"
fi

# ----- 8. 完成 -----
END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

echo ""
echo "============================================="
echo -e "${GREEN}✅ FamilyTimeFlow 部署完成！${NC}"
echo "   连接: ${REMOTE}"
echo "   前端: ${DOMAIN}/${PROJECT_PATH}/"
echo "   耗时: ${ELAPSED}s"
echo "============================================="

# Pushover (via Keychain, fallback to env vars)
if command -v curl >/dev/null 2>&1; then
    PUSHOVER_TOKEN="${PUSHOVER_NAS_TOKEN:-}"
    PUSHOVER_USER="${PUSHOVER_NAS_USER:-}"
    if [ -z "$PUSHOVER_TOKEN" ] && [ "$(uname)" = "Darwin" ]; then
        PUSHOVER_TOKEN=$(security find-generic-password -s "pushover-emma-token" -a "garychen" -w 2>/dev/null)
    fi
    if [ -z "$PUSHOVER_USER" ] && [ "$(uname)" = "Darwin" ]; then
        PUSHOVER_USER=$(security find-generic-password -s "pushover-emma-user" -a "garychen" -w 2>/dev/null)
    fi
    if [ -n "$PUSHOVER_TOKEN" ] && [ -n "$PUSHOVER_USER" ]; then
        COMMIT_MSG=$(cd "$SCRIPT_DIR/.." && git log -1 --oneline 2>/dev/null || echo "")
        NOTIFY_TITLE="FamilyTimeFlow"
        NOTIFY_MSG="✅ NAS 部署完成 (${REMOTE})"
        [ -n "$COMMIT_MSG" ] && NOTIFY_MSG="${NOTIFY_MSG}\n${COMMIT_MSG}"
        NOTIFY_MSG="${NOTIFY_MSG}\n路径: /${PROJECT_PATH}/"
        NOTIFY_MSG="${NOTIFY_MSG}\n耗时: ${ELAPSED}s"
        curl -s -X POST https://api.pushover.net/1/messages.json \
            --data-urlencode "token=${PUSHOVER_TOKEN}" \
            --data-urlencode "user=${PUSHOVER_USER}" \
            --data-urlencode "title=${NOTIFY_TITLE}" \
            --data-urlencode "message=${NOTIFY_MSG}" \
            --data-urlencode "sound=pushover" 2>/dev/null || true
    fi
fi

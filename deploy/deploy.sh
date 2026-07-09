#!/bin/sh
# ==============================================================================
# 🚀 FamilyTimeFlow — NAS 一键部署脚本 (WebDAV)
#
# 将本地 repo 中的前端文件部署到极空间 NAS。
# 使用 rclone + WebDAV 协议，内网 IP 优先，外网 Tailscale Funnel fallback。
# 脚本由 `sh deploy.sh` 调用。
#
# 目标路径（WebDAV 容器 clinedeploy-webdav）：
#   web/html/<PROJECT_PATH>/          → /docker/html/<PROJECT_PATH>/  (nginx 静态页)
#   web/nginx.conf.template            → /docker/nginx.conf           (nginx 配置)
#   web/docker-compose.yml             → /docker/                     (docker compose)
#   web/backend/<PROJECT_PATH>/        → /docker/backend/<PROJECT_PATH>/  (Node.js backend)
#
# 用法：
#   sh deploy/deploy.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 加载 ~/.nas-env 本地共享配置（如果存在），不提交 git，所有项目共享
[ -f ~/.nas-env ] && . ~/.nas-env

# 加载项目特定配置（如果存在），优先级更高
if [ -f "${SCRIPT_DIR}/../env.local" ]; then
    . "${SCRIPT_DIR}/../env.local"
fi

NAS_USER="${NAS_USER:-user}"
WEBDAV_USER="${WEBDAV_USER:-$NAS_USER}"
NAS_IP="${NAS_IP:-192.168.6.108}"
NAS_PORT="${NAS_WEBDAV_PORT:-8889}"
DOMAIN="${DOMAIN_PUBLIC:-https://remote-access-8888.zconnect.cn}"
KEYCHAIN_WEBDAV_SERVICE="${KEYCHAIN_WEBDAV_SERVICE:-emma-webdav}"
PROJECT_PATH="${PROJECT_PATH:-family-time-flow}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "============================================="
echo " 🚀 FamilyTimeFlow — NAS 部署 (WebDAV)"
echo "============================================="

# ----- 1. 读取 WebDAV 密码（跨平台）-----
PASSWORD=""

# macOS: 从 Keychain 读取
if [ "$(uname)" = "Darwin" ]; then
    PASSWORD=$(security find-generic-password -s "$KEYCHAIN_WEBDAV_SERVICE" -a "$USER" -w 2>/dev/null)
fi

# 后备：从环境变量读取
if [ -z "$PASSWORD" ] && [ -n "$WEBDAV_PASS" ]; then
    PASSWORD="$WEBDAV_PASS"
fi

# 最后：交互式输入
if [ -z "$PASSWORD" ]; then
    echo -e "${YELLOW}⚠️ 请输入 WebDAV 密码（输入时不显示）：${NC}"
    read -s PASSWORD
    echo ""
fi

if [ -z "$PASSWORD" ]; then
    echo -e "${RED}❌ 未提供 WebDAV 密码。${NC}"
    echo "   macOS: security add-generic-password -s \"${KEYCHAIN_WEBDAV_SERVICE}\" -a \"$USER\" -w \"密码\""
    echo "   Windows/macOS: export WEBDAV_PASS=\"密码\""
    exit 1
fi
PASSWORD=$(echo "$PASSWORD" | tr -d '\r\n')

# ----- 2. 检测网络环境（LAN vs 外网）-----
IS_LAN=false
if ip addr 2>/dev/null | grep -q "inet 192\.168\." || \
   ifconfig 2>/dev/null | grep -q "inet 192\.168\." || \
   hostname -I 2>/dev/null | grep -q "192\.168\."; then
    IS_LAN=true
fi

# ----- 3. 配置 rclone remotes -----
OBSCURED=$(rclone obscure "$PASSWORD")
rclone config delete ftf-nas-ip 2>/dev/null || true
rclone config delete ftf-nas-ts 2>/dev/null || true

rclone config create ftf-nas-ip webdav \
    url "http://${NAS_IP}:${NAS_PORT}" \
    vendor other user "$WEBDAV_USER" pass "$OBSCURED" > /dev/null 2>&1

rclone config create ftf-nas-ts webdav \
    url "$DOMAIN" \
    vendor other user "$WEBDAV_USER" pass "$OBSCURED" > /dev/null 2>&1

unset OBSCURED

# ----- 4. 确定可用 remote（LAN > 外网）-----
REMOTE=""
if [ "$IS_LAN" = true ]; then
    echo -e "${YELLOW}⏳ 检测到内网环境，测试 LAN: http://${NAS_IP}:${NAS_PORT}...${NC}"
    if rclone lsd ftf-nas-ip: --timeout 3s 2>/dev/null | grep -q "docker\|scripts"; then
        REMOTE="ftf-nas-ip"
        echo -e "${GREEN}✅ 内网连接成功${NC}"
    else
        echo -e "${YELLOW}⚠️  LAN 不通，尝试外网连接...${NC}"
    fi
fi

if [ -z "$REMOTE" ]; then
    echo -e "${YELLOW}⏳ 测试外网连接: ${DOMAIN}...${NC}"
    if rclone lsd ftf-nas-ts: --timeout 15s 2>/dev/null | grep -q "docker\|scripts"; then
        REMOTE="ftf-nas-ts"
        echo -e "${GREEN}✅ 外网连接成功${NC}"
    fi
fi

if [ -z "$REMOTE" ]; then
    echo -e "${RED}❌ 所有连接均失败（LAN + 外网）。${NC}"
    exit 1
fi

unset PASSWORD
START_TS=$(date +%s)

# ----- 5. 同步前端页面 -----
SOURCE_HTML="${SCRIPT_DIR}/../web/html/${PROJECT_PATH}"
if [ ! -d "$SOURCE_HTML" ]; then
    # Fallback to root html if project subdir doesn't exist
    SOURCE_HTML="${SCRIPT_DIR}/../web/html"
fi

echo ""
echo -e "${YELLOW}📄 同步前端页面 (→ /docker/html/${PROJECT_PATH}/)...${NC}"
rclone sync --delete-excluded "${SOURCE_HTML}/" "${REMOTE}:/docker/html/${PROJECT_PATH}/" 2>&1 | grep -v "NOTICE" | tail -2 || true
echo -e "${GREEN}✅ HTML 同步完成${NC}"

# ----- 6. 同步后端代码 (per PROJECT_PATH) -----
SOURCE_BACKEND="${SCRIPT_DIR}/../web/backend/${PROJECT_PATH}"
if [ ! -d "$SOURCE_BACKEND" ]; then
    # Fallback to root backend if project subdir doesn't exist
    SOURCE_BACKEND="${SCRIPT_DIR}/../web/backend"
fi

echo ""
echo -e "${YELLOW}📄 同步后端代码 (→ /docker/backend/${PROJECT_PATH}/)...${NC}"
rclone sync --delete-excluded "${SOURCE_BACKEND}/" "${REMOTE}:/docker/backend/${PROJECT_PATH}/" --exclude "node_modules" 2>&1 | grep -v "NOTICE" | tail -2 || true
echo -e "${GREEN}✅ 后端同步完成${NC}"

# ----- 7. 同步 Docker infra 文件 -----
echo ""
echo -e "${YELLOW}📄 同步 Docker 配置...${NC}"
if [ -f "${SCRIPT_DIR}/../web/docker-compose.yml" ]; then
    rclone copy "${SCRIPT_DIR}/../web/docker-compose.yml" "${REMOTE}:/docker/" 2>&1 | grep -v "NOTICE" | tail -1 || true
    echo "  ✅ docker-compose.yml"
fi

if [ -f "${SCRIPT_DIR}/../web/nginx.conf.template" ]; then
    # Generate nginx.conf with PROJECT_PATH variable substituted
    NGINX_CONF=$(sed "s|\${PROJECT_PATH}|${PROJECT_PATH}|g" "${SCRIPT_DIR}/../web/nginx.conf.template")
    echo "$NGINX_CONF" | rclone rcat "${REMOTE}:/docker/nginx.conf" 2>&1 | grep -v "NOTICE" | tail -1 || true
    echo "  ✅ nginx.conf (with ${PROJECT_PATH} path)"
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

# Pushover 通知
if command -v curl >/dev/null 2>&1; then
    COMMIT_MSG=$(cd "$SCRIPT_DIR/.." && git log -1 --oneline 2>/dev/null || echo "")
    NOTIFY_TITLE="FamilyTimeFlow"
    NOTIFY_MSG="✅ NAS 部署完成 (${REMOTE})"
    [ -n "$COMMIT_MSG" ] && NOTIFY_MSG="${NOTIFY_MSG}\n${COMMIT_MSG}"
    NOTIFY_MSG="${NOTIFY_MSG}\n路径: /${PROJECT_PATH}/"
    NOTIFY_MSG="${NOTIFY_MSG}\n耗时: ${ELAPSED}s"

    curl -s -X POST https://api.pushover.net/1/messages.json \
        --data-urlencode "token=${PUSHOVER_NAS_TOKEN:-}" \
        --data-urlencode "user=${PUSHOVER_NAS_USER:-}" \
        --data-urlencode "title=${NOTIFY_TITLE}" \
        --data-urlencode "message=${NOTIFY_MSG}" \
        --data-urlencode "sound=pushover" 2>/dev/null || true
fi
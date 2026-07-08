#!/bin/sh
# ==============================================================================
# NAS Deployment Script (generic template)
# Reads config from env.local, deploys via rclone WebDAV
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "${SCRIPT_DIR}/../env.local" ]; then
    . "${SCRIPT_DIR}/../env.local"
fi

NAS_USER="${NAS_USER:-user}"
NAS_IP="${NAS_IP:-192.168.1.1}"
NAS_PORT="${NAS_WEBDAV_PORT:-8889}"

echo "=== Deploying ${PROJECT_NAME:-project} ==="
echo "Target: ${NAS_IP}:${NAS_PORT}"
echo ""
echo "Customize this script for your project:"
echo "  - Add rclone sync commands"
echo "  - Add Keychain credential reading"
echo "  - Add notification on completion"
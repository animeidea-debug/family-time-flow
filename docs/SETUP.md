# Setup Guide

## Prerequisites

- A ZSpace NAS (or any Linux host with Docker)
- macOS development machine (or Windows with Git Bash)
- Tailscale Funnel or ZSpace remote access configured
- Docker & Docker Compose on the NAS

## Quick Start

### 1. Ensure shared NAS config exists

```sh
# Check if ~/.nas-env already has your NAS details
cat ~/.nas-env

# If not, create it:
# NAS_IP="192.168.x.x"
# NAS_USER="your-username"
# NAS_SSH_PORT="10000"
# NAS_WEBDAV_PORT="8889"
# SSH_HOST_ALIAS="nas"
# KEYCHAIN_SSH_SERVICE="nas-ssh"
# KEYCHAIN_WEBDAV_SERVICE="emma-webdav"
```

### 2. Store passwords in macOS Keychain (one-time)

```sh
# WebDAV password (for deploy)
security add-generic-password -s "emma-webdav" -a "$USER" -w "your-webdav-password"

# SSH password (if not using key-based auth)
security add-generic-password -s "nas-ssh" -a "your-username" -w "your-ssh-password"
```

### 3. Configure project

```sh
cp env.template env.local
vim env.local   # Set project name, ports
```

### 4. Deploy to NAS

```sh
# Deploy frontend + backend to NAS via WebDAV
sh deploy/deploy.sh
```

### 5. SSH into NAS (for maintenance)

```sh
# Uses SSH key at ~/.ssh/nas_ed25519 (passwordless)
ssh nas
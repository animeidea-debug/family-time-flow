# Setup Guide

## Prerequisites

- A ZSpace NAS (or any Linux host with Docker)
- macOS development machine (or Windows with Git Bash)
- Tailscale Funnel or ZSpace remote access configured

## Steps

### 1. Create project from template

Click "Use this template" on GitHub → clone locally.

### 2. Configure environment

````sh
cp env.template env.local
vim env.local   # Set IP, domain, ports
````

### 3. Set up HTTP directory

```sh
mkdir -p html gas
echo "<h1>Hello World</h1>" > html/index.html
```

### 4. Deploy to NAS

```sh
# macOS: Keychain-based auth
sh deploy/deploy.sh

# Windows: env var-based auth
.\deploy\run_deploy.bat
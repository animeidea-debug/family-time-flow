#!/bin/sh
# ==============================================================================
# GAS Deployment (generic template)
# Pushes gas/ directory to Google Apps Script
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "${SCRIPT_DIR}/../gas/.clasp.json" ]; then
    echo "No gas/ directory found. Create one with 'clasp create' first."
    exit 1
fi

cd "${SCRIPT_DIR}/../gas" || exit 1
clasp push
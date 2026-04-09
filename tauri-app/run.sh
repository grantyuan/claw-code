#!/bin/bash

# ClawCode - One Command to Run Everything
# Usage: ./run.sh [command]

set -e

cd "$(dirname "$0")"

echo "🚀 ClawCode - AI Agent Desktop Application"
echo "============================================"

case "${1:-start}" in
  "start"|"run"|"dev")
    echo ""
    echo "Starting ClawCode..."
    echo "   • CLI Server will start automatically on http://localhost:8766"
    echo "   • WebSocket available at ws://localhost:8766/ws"
    echo ""
    npm run tauri dev
    ;;
  "build"|"release")
    echo "Building production release..."
    npm run tauri build
    echo "✅ Build complete! Check src-tauri/target/release/"
    ;;
  "test"|"tests")
    echo "Running tests..."
    npm test
    ;;
  "frontend")
    echo "Starting frontend only (no CLI server)..."
    npm run dev
    ;;
  *)
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start, run, dev    - Start ClawCode (default)"
    echo "  build, release     - Build production release"
    echo "  test               - Run tests"
    echo "  frontend           - Frontend only (no CLI server)"
    exit 1
    ;;
esac

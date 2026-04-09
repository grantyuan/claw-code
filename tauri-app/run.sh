#!/bin/bash

# ClawCode - One Command to Run Everything
# Usage: ./run.sh [command]

set -e

cd "$(dirname "$0")"

# Ensure native Rust is used (not Snap version)
if [[ "$PATH" == *"/snap/bin"* ]] && [[ -f "$HOME/.cargo/env" ]]; then
    echo "ℹ️  Switching to native Rust (not Snap version)..."
    source "$HOME/.cargo/env"
fi

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not found. Please install Rust:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "   source \$HOME/.cargo/env"
    exit 1
fi

# Check if using Snap version of cargo
if [[ "$(which cargo)" == *"/snap/"* ]]; then
    echo "❌ Detected Snap version of Rust. This won't work with Tauri."
    echo ""
    echo "Please install native Rust:"
    echo "   1. sudo snap remove rustup"
    echo "   2. curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "   3. source \$HOME/.cargo/env"
    exit 1
fi

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

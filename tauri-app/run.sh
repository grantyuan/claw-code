#!/bin/bash

# ClawCode - One Command to Run Everything
# Usage: ./run.sh [command]

set -e

cd "$(dirname "$0")"

# Install native Rust if not present or if Snap is in PATH
install_native_rust() {
    if [[ -f "$HOME/.cargo/bin/cargo" ]]; then
        echo "ℹ️  Native Rust already installed at ~/.cargo/bin"
    else
        echo "📦 Installing native Rust to ~/.cargo/bin..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
        echo "✅ Native Rust installed"
    fi
}

# Set PATH to prefer native Rust over Snap
setup_rust_path() {
    if [[ -f "$HOME/.cargo/env" ]]; then
        source "$HOME/.cargo/env"
    fi

    if [[ -d "$HOME/.cargo/bin" ]]; then
        export PATH="$HOME/.cargo/bin:$PATH"
    fi
}

# Auto-install and setup native Rust
if [[ "$PATH" == *"/snap/bin"* ]] || [[ "$(which cargo 2>/dev/null)" == *"/snap/"* ]] || [[ ! -f "$HOME/.cargo/bin/cargo" ]]; then
    install_native_rust
    setup_rust_path
fi

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not found. Please install Rust:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo "🚀 ClawCode - AI Agent Desktop Application"
echo "============================================"
echo "   Cargo: $(which cargo)"

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

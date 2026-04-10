#!/bin/bash

# ClawCode Development Environment Setup
# Installs: Rust, Tauri dependencies, Zig cross-compiler

set -e

echo "🔧 ClawCode Development Environment Setup"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [[ -f /etc/debian_version ]]; then
            echo "debian"
        elif [[ -f /etc/fedora-release ]]; then
            echo "fedora"
        elif [[ -f /etc/arch-release ]]; then
            echo "arch"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo "📌 Detected OS: $OS"
echo ""

# 1. Install Rust
echo "1️⃣  Installing Rust (rustup)..."
install_rust() {
    if command -v rustup &> /dev/null && [[ "$(which rustup)" != *"/snap/"* ]]; then
        echo "   ✓ Rust already installed: $(which rustc)"
        rustup update stable 2>/dev/null || true
    elif [[ -f "$HOME/.cargo/bin/rustup" ]]; then
        echo "   ✓ Native Rust found at ~/.cargo/bin"
        export PATH="$HOME/.cargo/bin:$PATH"
        source "$HOME/.cargo/env" 2>/dev/null || true
        rustup update stable 2>/dev/null || true
    else
        echo "   📦 Installing rustup..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
        source "$HOME/.cargo/env"
        echo "   ✓ Rust installed: $(which rustc)"
    fi
}
install_rust
echo ""

# 2. Install Tauri system dependencies
echo "2️⃣  Installing Tauri system dependencies..."

install_tauri_deps() {
    case $OS in
        debian)
            echo "   📦 Installing Debian/Ubuntu dependencies..."
            sudo_cmd=""
            if command -v sudo &> /dev/null; then
                sudo_cmd="sudo"
            fi
            
            $sudo_cmd apt-get update -qq
            $sudo_cmd apt-get install -y \
                libwebkit2gtk-4.1-dev \
                libgtk-3-dev \
                libayatana-appindicator3-dev \
                librsvg2-dev \
                patchelf \
                libssl-dev \
                libdbus-1-dev \
                libglib2.0-dev \
                libx11-dev \
                libxcb-shape0-dev \
                libxcb-xfixes0-dev \
                libxkbcommon-dev \
                libxcb-keysyms1-dev \
                libxcb-render0-dev \
                libxcb-shm0-dev \
                libxcb-icccm4-dev \
                libxcb-image0-dev \
                libxcb-util-dev \
                libxext6 \
                libxrender1 \
                libxrandr2 \
                libgbm1 \
                libasound2-dev \
                libpango-1.0-0 \
                libpangocairo-1.0-0 \
                libatk1.0-dev \
                libatk-bridge2.0-dev
            echo "   ✓ Debian dependencies installed"
            ;;
        fedora)
            echo "   📦 Installing Fedora dependencies..."
            sudo dnf install -y \
                webkit2gtk4.1-devel \
                gtk3-devel \
                libappindicator-gtk3-devel \
                librsvg2-devel \
                openssl-devel \
                dbus-devel \
                glib2-devel \
                libx11-devel \
                libxcb-devel \
                libxkbcommon-devel \
                alsa-lib-devel \
                pango-devel \
                atk-devel
            echo "   ✓ Fedora dependencies installed"
            ;;
        arch)
            echo "   📦 Installing Arch Linux dependencies..."
            sudo pacman -S --noconfirm \
                webkit2gtk-4.1 \
                gtk3 \
                libappindicator-gtk3 \
                librsvg \
                patchelf \
                openssl \
                dbus-glib \
                glib2 \
                libx11 \
                libxcb \
                libxkbcommon \
                alsa-lib \
                pango \
                atk
            echo "   ✓ Arch dependencies installed"
            ;;
        macos)
            echo "   📦 Installing macOS dependencies..."
            if command -v brew &> /dev/null; then
                brew install \
                   webkit2gtk gtk+3 adwaita-icon-theme \
                    atk cairo pango gdk-pixbuf \
                    libffi autoconf automake
                echo "   ✓ macOS dependencies installed via Homebrew"
            else
                echo "   ⚠️  Homebrew not found. Please install from https://brew.sh"
            fi
            ;;
        windows)
            echo "   ℹ️  Windows detected - Install Visual Studio Build Tools"
            echo "      Download: https://visualstudio.microsoft.com/downloads/"
            echo "      Select: 'Desktop development with C++'"
            ;;
        *)
            echo "   ⚠️  Unknown OS. Please install Tauri dependencies manually."
            echo "      See: https://tauri.app/start/prerequisites/"
            ;;
    esac
}

# Check if running in container (no sudo)
if [[ "$(uname -o)" == *"container"* ]] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    echo "   ℹ️  Container detected - skipping sudo operations"
    echo "   ℹ️  Please install system dependencies manually or with host package manager"
else
    install_tauri_deps
fi
echo ""

# 3. Install Zig for cross-compilation
echo "3️⃣  Installing Zig (for cross-compilation)..."
install_zig() {
    if command -v zig &> /dev/null; then
        echo "   ✓ Zig already installed: $(which zig)"
        echo "   ✓ Zig version: $(zig version)"
    else
        echo "   📦 Downloading Zig..."
        local ZIG_VERSION="0.13.0"
        local ZIG_DIR="$HOME/.local/zig"
        
        mkdir -p "$ZIG_DIR"
        
        if [[ "$(uname -m)" == "x86_64" ]]; then
            local ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/zig-linux-x86_64-${ZIG_VERSION}.tar.xz"
        elif [[ "$(uname -m)" == "aarch64" ]]; then
            local ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/zig-linux-aarch64-${ZIG_VERSION}.tar.xz"
        else
            echo "   ⚠️  Unknown architecture: $(uname -m)"
            return
        fi
        
        echo "   📥 Downloading from $ZIG_URL"
        curl -L "$ZIG_URL" | tar -xJ -C "$ZIG_DIR" --strip-components=1
        
        export PATH="$ZIG_DIR:$PATH"
        
        echo "   ✓ Zig installed: $(which zig)"
        echo "   ✓ Zig version: $(zig version)"
        
        echo ""
        echo "   ℹ️  Add to PATH: export PATH=\"$ZIG_DIR:\$PATH\""
    fi
}
install_zig
echo ""

# 4. Configure Rust targets for cross-compilation
echo "4️⃣  Configuring Rust cross-compilation targets..."
configure_rust_targets() {
    source "$HOME/.cargo/env" 2>/dev/null || true
    export PATH="$HOME/.cargo/bin:$PATH"
    
    echo "   Adding cross-compilation targets..."
    rustup target add aarch64-unknown-linux-gnu 2>/dev/null || true
    rustup target add armv7-unknown-linux-gnueabihf 2>/dev/null || true
    rustup target add x86_64-unknown-linux-musl 2>/dev/null || true
    
    # Install cross toolchains if available
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y \
            gcc-aarch64-linux-gnu \
            gcc-arm-linux-gnueabihf \
            musl-tools 2>/dev/null || true
    fi
    
    echo "   ✓ Cross-compilation targets configured"
}
configure_rust_targets
echo ""

# 5. Verify installation
echo "5️⃣  Verifying installation..."
echo ""
echo "   Rust:"
echo "      cargo:  $(which cargo 2>/dev/null || echo 'NOT FOUND')"
echo "      rustc:  $(which rustc 2>/dev/null || echo 'NOT FOUND')"
echo "      version: $(rustc --version 2>/dev/null || echo 'NOT FOUND')"
echo ""
echo "   Zig:"
echo "      zig:    $(which zig 2>/dev/null || echo 'NOT FOUND')"
echo "      version: $(zig version 2>/dev/null || echo 'NOT FOUND')"
echo ""

# 6. Summary
echo "========================================="
echo "✅ Development environment setup complete!"
echo ""
echo "Next steps:"
echo "   cd /home/dss/work_py3_12/claw-code/tauri-app"
echo "   ./run.sh"
echo ""
echo "Optional: Add to your shell profile (~/.bashrc or ~/.zshrc):"
echo "   export PATH=\"\$HOME/.cargo/bin:\$HOME/.local/zig:\$PATH\""
echo "   source \"\$HOME/.cargo/env\""
echo "========================================="

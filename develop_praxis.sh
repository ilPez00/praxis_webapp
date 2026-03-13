#!/bin/bash

# develop_praxis.sh - Setup development environment for Praxis WebApp
# Supported Distros: Debian/Ubuntu, Fedora, Arch Linux

set -e

echo "🚀 Starting Praxis Development Environment Setup..."

# --- 1. Detect OS ---
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    LIKE=$ID_LIKE
else
    echo "❌ Could not detect OS. Exiting."
    exit 1
fi

echo "📦 Detected OS: $OS (Like: $LIKE)"

# --- 2. Install System Packages ---
case "$OS" in
    debian|ubuntu)
        echo "🔹 Updating and installing for Debian/Ubuntu..."
        sudo apt-get update
        sudo apt-get install -y git micro zsh curl wget build-essential libssl-dev \
            bat lsd ranger fd-find fastfetch thefuck zoxide direnv \
            texlive-xetex texlive-fonts-recommended texlive-plain-generic \
            latexmk python3-pip xdg-utils
        # On Debian, bat is batcat and fd is fdfind
        mkdir -p ~/.local/bin
        ln -sf /usr/bin/batcat ~/.local/bin/bat 2>/dev/null || true
        ln -sf /usr/bin/fdfind ~/.local/bin/fd 2>/dev/null || true
        ;;
    fedora)
        echo "🔹 Updating and installing for Fedora..."
        sudo dnf update -y
        sudo dnf install -y git micro zsh curl wget gcc-c++ make openssl-devel \
            bat lsd ranger fd-find fastfetch thefuck zoxide direnv \
            texlive-xetex texlive-latexmk texlive-scheme-medium \
            python3-pip xdg-utils
        ;;
    arch)
        echo "🔹 Updating and installing for Arch..."
        sudo pacman -Syu --noconfirm
        sudo pacman -S --noconfirm git micro zsh curl wget base-devel \
            bat lsd ranger fd fastfetch thefuck zoxide direnv \
            texlive-bin texlive-core texlive-latexextra \
            python-pip xdg-utils
        ;;
    *)
        # Try "LIKE" check for Arch derivatives (Manjaro, etc)
        if [[ "$LIKE" == *"arch"* ]]; then
             echo "🔹 Updating and installing for Arch-like distro..."
             sudo pacman -Syu --noconfirm
             sudo pacman -S --noconfirm git micro zsh curl wget base-devel \
                 bat lsd ranger fd fastfetch thefuck zoxide direnv \
                 texlive-bin texlive-core texlive-latexextra \
                 python-pip xdg-utils
        else
            echo "❌ Unsupported OS: $OS. Please install tools manually."
            exit 1
        fi
        ;;
esac

# --- 3. Install NVM and Node.js ---
if [ ! -d "$HOME/.oh-my-zsh" ]; then
    echo "🔹 Installing Oh My Zsh..."
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
fi

if [ ! -d "$HOME/.nvm" ]; then
    echo "🔹 Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    echo "🔹 Installing Node.js 20..."
    nvm install 20
    nvm use 20
fi

# --- 4. Install uv and NotebookLM CLI ---
if ! command -v uv &> /dev/null; then
    echo "🔹 Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.local/bin/env
fi

echo "🔹 Installing NotebookLM CLI (nlm)..."
uv tool install notebooklm-mcp-cli --force

# --- 5. Install gemini-cli and other project tools ---
echo "🔹 Installing Gemini CLI and global npm packages..."
npm install -g @google/gemini-cli vercel @railway/cli

# --- 6. Install Zsh Plugins and Themes ---
ZSH_CUSTOM=${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}
if [ ! -d "$ZSH_CUSTOM/themes/powerlevel10k" ]; then
    echo "🔹 Installing Powerlevel10k..."
    git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "$ZSH_CUSTOM/themes/powerlevel10k"
fi

if [ ! -d "$ZSH_CUSTOM/plugins/zsh-autosuggestions" ]; then
    echo "🔹 Installing zsh-autosuggestions..."
    git clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
fi

if [ ! -d "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting" ]; then
    echo "🔹 Installing zsh-syntax-highlighting..."
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"
fi

# --- 7. Configure Dotfiles ---
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "🔹 Configuring .zshrc and .p10k.zsh from Praxis repo..."

if [ -f "$SCRIPT_DIR/scripts/dotfiles/zshrc" ]; then
    cp "$SCRIPT_DIR/scripts/dotfiles/zshrc" "$HOME/.zshrc"
    echo "✅ .zshrc updated."
fi

if [ -f "$SCRIPT_DIR/scripts/dotfiles/p10k.zsh" ]; then
    cp "$SCRIPT_DIR/scripts/dotfiles/p10k.zsh" "$HOME/.p10k.zsh"
    echo "✅ .p10k.zsh updated."
fi

# Set Zsh as default shell if possible
if [ "$SHELL" != "$(which zsh)" ]; then
    echo "🔹 Changing default shell to zsh..."
    sudo chsh -s "$(which zsh)" "$USER"
fi

echo "✨ Praxis Development Environment Setup Complete!"
echo "Please restart your terminal or run 'source ~/.zshrc' to apply changes."

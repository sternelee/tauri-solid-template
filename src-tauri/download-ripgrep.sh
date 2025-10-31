#!/bin/bash

# Script to download ripgrep binaries for all supported platforms
# This script should be run from the src-tauri directory

set -e

RIPGREP_VERSION="14.1.1"
BINARIES_DIR="binaries"
TEMP_DIR="temp_ripgrep"

# Create directories
mkdir -p "$BINARIES_DIR"
mkdir -p "$TEMP_DIR"

echo "Downloading ripgrep version $RIPGREP_VERSION for all platforms..."

# Function to download and extract ripgrep
download_ripgrep() {
  local platform=$1
  local archive=$2
  local binary_name=$3
  local extract_path=$4

  echo "Downloading ripgrep for $platform..."

  local url="https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${archive}"

  cd "$TEMP_DIR"

  if [[ $archive == *.tar.gz ]]; then
    wget -q "$url" -O "$archive" || curl -fsSL "$url" -o "$archive"
    tar -xzf "$archive"
    cp "$extract_path/rg" "../$BINARIES_DIR/$binary_name"
    chmod +x "../$BINARIES_DIR/$binary_name"
  elif [[ $archive == *.zip ]]; then
    wget -q "$url" -O "$archive" || curl -fsSL "$url" -o "$archive"
    unzip -q "$archive"
    cp "$extract_path/rg.exe" "../$BINARIES_DIR/$binary_name"
  fi

  cd ..

  echo "✓ Downloaded and extracted $binary_name"
}

# Download for each platform
download_ripgrep \
  "Linux x86_64" \
  "ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
  "rg-x86_64-unknown-linux-musl" \
  "ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl"

download_ripgrep \
  "macOS x86_64" \
  "ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin.tar.gz" \
  "rg-x86_64-apple-darwin" \
  "ripgrep-${RIPGREP_VERSION}-x86_64-apple-darwin"

download_ripgrep \
  "macOS ARM64" \
  "ripgrep-${RIPGREP_VERSION}-aarch64-apple-darwin.tar.gz" \
  "rg-aarch64-apple-darwin" \
  "ripgrep-${RIPGREP_VERSION}-aarch64-apple-darwin"

download_ripgrep \
  "Windows x86_64" \
  "ripgrep-${RIPGREP_VERSION}-x86_64-pc-windows-msvc.zip" \
  "rg-x86_64-pc-windows-msvc.exe" \
  "ripgrep-${RIPGREP_VERSION}-x86_64-pc-windows-msvc"

# Note: Windows ARM64 version may not be available for all ripgrep releases
# Uncomment the following if available:
# download_ripgrep \
#     "Windows ARM64" \
#     "ripgrep-${RIPGREP_VERSION}-aarch64-pc-windows-msvc.zip" \
#     "rg-aarch64-pc-windows-msvc.exe" \
#     "ripgrep-${RIPGREP_VERSION}-aarch64-pc-windows-msvc"

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "✅ All ripgrep binaries downloaded successfully!"
echo "Binaries are located in: $BINARIES_DIR/"
echo ""
ls -lh "$BINARIES_DIR/"

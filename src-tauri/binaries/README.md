# Ripgrep Sidecar Binaries

This directory contains the ripgrep (rg) binaries that will be bundled with the application as sidecars.

## Why Sidecar Binaries?

The application checks if ripgrep is installed on the user's system. If it's not found, it will use the bundled sidecar binary. This ensures the search functionality works regardless of whether the user has ripgrep installed.

## Downloading Ripgrep Binaries

Download the ripgrep binaries for each platform from the official releases:
https://github.com/BurntSushi/ripgrep/releases

### Required Files:

1. **Linux (x86_64)**: `rg-x86_64-unknown-linux-musl` or `rg-x86_64-unknown-linux-gnu`
   - Download: `ripgrep-{version}-x86_64-unknown-linux-musl.tar.gz`
   - Extract the `rg` binary and rename it to: `rg-x86_64-unknown-linux-musl`

2. **macOS (x86_64)**: `rg-x86_64-apple-darwin`
   - Download: `ripgrep-{version}-x86_64-apple-darwin.tar.gz`
   - Extract the `rg` binary and rename it to: `rg-x86_64-apple-darwin`

3. **macOS (ARM64/M1/M2)**: `rg-aarch64-apple-darwin`
   - Download: `ripgrep-{version}-aarch64-apple-darwin.tar.gz`
   - Extract the `rg` binary and rename it to: `rg-aarch64-apple-darwin`

4. **Windows (x86_64)**: `rg-x86_64-pc-windows-msvc.exe`
   - Download: `ripgrep-{version}-x86_64-pc-windows-msvc.zip`
   - Extract the `rg.exe` binary and rename it to: `rg-x86_64-pc-windows-msvc.exe`

5. **Windows (ARM64)**: `rg-aarch64-pc-windows-msvc.exe`
   - Download: `ripgrep-{version}-aarch64-pc-windows-msvc.zip`
   - Extract the `rg.exe` binary and rename it to: `rg-aarch64-pc-windows-msvc.exe`

### File Naming Convention:

Tauri uses a specific naming convention for sidecar binaries:
```
{binary-name}-{rust-target-triple}{.exe}
```

Examples:
- `rg-x86_64-unknown-linux-musl`
- `rg-x86_64-apple-darwin`
- `rg-aarch64-apple-darwin`
- `rg-x86_64-pc-windows-msvc.exe`
- `rg-aarch64-pc-windows-msvc.exe`

### Installation Steps:

1. Download the appropriate ripgrep archive for your platform
2. Extract the archive
3. Rename the binary according to the convention above
4. Place it in this `binaries/` directory
5. Make sure Linux/macOS binaries are executable: `chmod +x rg-*`

### Example Download Commands:

```bash
# For Linux x86_64
wget https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-x86_64-unknown-linux-musl.tar.gz
tar -xzf ripgrep-14.1.1-x86_64-unknown-linux-musl.tar.gz
cp ripgrep-14.1.1-x86_64-unknown-linux-musl/rg ./rg-x86_64-unknown-linux-musl
chmod +x rg-x86_64-unknown-linux-musl

# For macOS x86_64
wget https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-x86_64-apple-darwin.tar.gz
tar -xzf ripgrep-14.1.1-x86_64-apple-darwin.tar.gz
cp ripgrep-14.1.1-x86_64-apple-darwin/rg ./rg-x86_64-apple-darwin
chmod +x rg-x86_64-apple-darwin

# For macOS ARM64
wget https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-aarch64-apple-darwin.tar.gz
tar -xzf ripgrep-14.1.1-aarch64-apple-darwin.tar.gz
cp ripgrep-14.1.1-aarch64-apple-darwin/rg ./rg-aarch64-apple-darwin
chmod +x rg-aarch64-apple-darwin

# For Windows x86_64 (in PowerShell)
Invoke-WebRequest -Uri https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep-14.1.1-x86_64-pc-windows-msvc.zip -OutFile ripgrep.zip
Expand-Archive ripgrep.zip
Copy-Item ripgrep\ripgrep-14.1.1-x86_64-pc-windows-msvc\rg.exe .\rg-x86_64-pc-windows-msvc.exe
```

### Notes:

- The binaries should be placed directly in this directory, not in subdirectories
- Make sure the binaries have execute permissions on Unix-like systems
- The `.gitignore` file excludes actual binaries to keep the repository size small
- For CI/CD, you may want to download these binaries as part of the build process
- Current ripgrep version: 14.1.1 (check for newer versions at the releases page)

### Automated Download Script:

You can create a script to download all binaries automatically. See `download-ripgrep.sh` (if provided) or create one based on the commands above.

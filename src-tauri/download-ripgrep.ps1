# PowerShell script to download ripgrep binaries for all supported platforms
# Run this script from the src-tauri directory

$ErrorActionPreference = "Stop"

$RIPGREP_VERSION = "14.1.1"
$BINARIES_DIR = "binaries"
$TEMP_DIR = "temp_ripgrep"

# Create directories
New-Item -ItemType Directory -Force -Path $BINARIES_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

Write-Host "Downloading ripgrep version $RIPGREP_VERSION for all platforms..." -ForegroundColor Green

function Download-Ripgrep {
    param(
        [string]$Platform,
        [string]$Archive,
        [string]$BinaryName,
        [string]$ExtractPath
    )
    
    Write-Host "Downloading ripgrep for $Platform..." -ForegroundColor Cyan
    
    $url = "https://github.com/BurntSushi/ripgrep/releases/download/$RIPGREP_VERSION/$Archive"
    $archivePath = Join-Path $TEMP_DIR $Archive
    
    # Download
    Invoke-WebRequest -Uri $url -OutFile $archivePath
    
    # Extract
    if ($Archive -like "*.tar.gz") {
        # For tar.gz files, we need 7-Zip or tar command
        tar -xzf $archivePath -C $TEMP_DIR
        $sourceBinary = Join-Path $TEMP_DIR "$ExtractPath\rg"
        $destBinary = Join-Path $BINARIES_DIR $BinaryName
        Copy-Item $sourceBinary $destBinary
    }
    elseif ($Archive -like "*.zip") {
        Expand-Archive -Path $archivePath -DestinationPath $TEMP_DIR -Force
        $sourceBinary = Join-Path $TEMP_DIR "$ExtractPath\rg.exe"
        $destBinary = Join-Path $BINARIES_DIR $BinaryName
        Copy-Item $sourceBinary $destBinary
    }
    
    Write-Host "✓ Downloaded and extracted $BinaryName" -ForegroundColor Green
}

# Download for each platform
try {
    Download-Ripgrep `
        -Platform "Linux x86_64" `
        -Archive "ripgrep-$RIPGREP_VERSION-x86_64-unknown-linux-musl.tar.gz" `
        -BinaryName "rg-x86_64-unknown-linux-musl" `
        -ExtractPath "ripgrep-$RIPGREP_VERSION-x86_64-unknown-linux-musl"

    Download-Ripgrep `
        -Platform "macOS x86_64" `
        -Archive "ripgrep-$RIPGREP_VERSION-x86_64-apple-darwin.tar.gz" `
        -BinaryName "rg-x86_64-apple-darwin" `
        -ExtractPath "ripgrep-$RIPGREP_VERSION-x86_64-apple-darwin"

    Download-Ripgrep `
        -Platform "macOS ARM64" `
        -Archive "ripgrep-$RIPGREP_VERSION-aarch64-apple-darwin.tar.gz" `
        -BinaryName "rg-aarch64-apple-darwin" `
        -ExtractPath "ripgrep-$RIPGREP_VERSION-aarch64-apple-darwin"

    Download-Ripgrep `
        -Platform "Windows x86_64" `
        -Archive "ripgrep-$RIPGREP_VERSION-x86_64-pc-windows-msvc.zip" `
        -BinaryName "rg-x86_64-pc-windows-msvc.exe" `
        -ExtractPath "ripgrep-$RIPGREP_VERSION-x86_64-pc-windows-msvc"

    # Note: Windows ARM64 version may not be available for all ripgrep releases
    # Uncomment the following if available:
    # Download-Ripgrep `
    #     -Platform "Windows ARM64" `
    #     -Archive "ripgrep-$RIPGREP_VERSION-aarch64-pc-windows-msvc.zip" `
    #     -BinaryName "rg-aarch64-pc-windows-msvc.exe" `
    #     -ExtractPath "ripgrep-$RIPGREP_VERSION-aarch64-pc-windows-msvc"
}
finally {
    # Clean up
    if (Test-Path $TEMP_DIR) {
        Remove-Item -Path $TEMP_DIR -Recurse -Force
    }
}

Write-Host ""
Write-Host "✅ All ripgrep binaries downloaded successfully!" -ForegroundColor Green
Write-Host "Binaries are located in: $BINARIES_DIR\"
Write-Host ""
Get-ChildItem -Path $BINARIES_DIR -File | Select-Object Name, Length

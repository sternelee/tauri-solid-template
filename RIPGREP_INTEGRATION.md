# Ripgrep Integration with Sidecar Support

This document explains the ripgrep integration in the Tauri backend, which provides intelligent file search functionality with automatic fallback to bundled binaries.

## Overview

The application integrates ripgrep (rg) for fast file searching. The implementation automatically:
1. Checks if ripgrep is installed on the user's system
2. Falls back to bundled sidecar binaries if not found
3. Provides seamless search functionality across all platforms

## Architecture

### Module Structure

```
src-tauri/
├── src/
│   ├── ripgrep.rs          # Ripgrep helper module
│   ├── search.rs           # Search commands using ripgrep
│   └── lib.rs              # Main library with command registration
├── binaries/               # Sidecar binaries directory
│   ├── README.md           # Binary download instructions
│   └── .gitignore          # Excludes binaries from git
├── download-ripgrep.sh     # Unix binary download script
└── download-ripgrep.ps1    # Windows binary download script
```

### Key Components

#### 1. ripgrep.rs Module

This module provides the core functionality for ripgrep integration:

```rust
// Check if ripgrep is installed on the system
fn is_ripgrep_installed() -> bool

// Get the ripgrep command path (system or sidecar)
pub fn get_ripgrep_command(app_handle: &tauri::AppHandle) -> Result<String, String>

// Execute ripgrep with given arguments
pub fn execute_ripgrep(
    app_handle: &tauri::AppHandle,
    args: &[String],
) -> Result<std::process::Output, String>
```

**Logic Flow:**
1. First checks if `rg --version` runs successfully (system installation)
2. If yes, returns "rg" to use system binary
3. If no, retrieves sidecar binary path from Tauri
4. Returns the appropriate path for execution

#### 2. search.rs Module

Provides three main commands exposed to the frontend:

```rust
// Search for files with pattern matching
#[tauri::command]
pub fn search_files(
    app_handle: tauri::AppHandle,
    options: SearchOptions,
    search_path: Option<String>,
) -> Result<Vec<SearchResult>, String>

// Search for screenshot files
#[tauri::command]
pub fn search_screenshots(
    app_handle: tauri::AppHandle,
    search_path: Option<String>,
) -> Result<Vec<SearchResult>, String>

// Get common search directories
#[tauri::command]
pub fn get_search_directories() -> Result<Vec<String>, String>
```

**Search Options:**
- `pattern`: Search pattern (regex supported)
- `max_results`: Maximum number of results
- `file_extensions`: Filter by file extensions
- `include_hidden`: Include hidden files/directories

#### 3. Sidecar Configuration

In `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": [
      "binaries/rg"
    ]
  }
}
```

Tauri automatically handles platform-specific binary selection based on naming convention:
- `rg-x86_64-unknown-linux-musl` (Linux x86_64)
- `rg-x86_64-apple-darwin` (macOS Intel)
- `rg-aarch64-apple-darwin` (macOS Apple Silicon)
- `rg-x86_64-pc-windows-msvc.exe` (Windows x64)

## Usage

### From Frontend (TypeScript/JavaScript)

```typescript
import { invoke } from '@tauri-apps/api/core';

// Search for files
const results = await invoke('search_files', {
  options: {
    pattern: 'function',
    max_results: 100,
    file_extensions: ['js', 'ts', 'jsx', 'tsx'],
    include_hidden: false
  },
  search_path: '/path/to/search'
});

// Search for screenshots
const screenshots = await invoke('search_screenshots', {
  search_path: '/home/user/Pictures'
});

// Get common search directories
const directories = await invoke('get_search_directories');
```

### Search Result Structure

```typescript
interface SearchResult {
  path: string;              // File path
  line_number?: number;      // Line number (for content matches)
  content?: string;          // Matched content
  file_type: string;         // Detected file type (e.g., "JavaScript", "Rust")
}
```

## Binary Management

### Downloading Binaries

Before building the application for distribution, download the ripgrep binaries:

**On Linux/macOS:**
```bash
cd src-tauri
./download-ripgrep.sh
```

**On Windows (PowerShell):**
```powershell
cd src-tauri
.\download-ripgrep.ps1
```

### Manual Download

If the scripts don't work, manually download from:
https://github.com/BurntSushi/ripgrep/releases

See `src-tauri/binaries/README.md` for detailed instructions.

### Binary Naming Convention

Tauri requires specific naming for sidecar binaries:
```
{binary-name}-{rust-target-triple}{.exe}
```

Examples:
- `rg-x86_64-unknown-linux-musl` (Linux)
- `rg-aarch64-apple-darwin` (macOS ARM)
- `rg-x86_64-pc-windows-msvc.exe` (Windows)

## Development

### Building the Project

1. Download ripgrep binaries (see above)
2. Build the Tauri application:
   ```bash
   pnpm install
   pnpm tauri build
   ```

### Testing Without Ripgrep Installed

To test the sidecar fallback:
1. Temporarily rename/remove system ripgrep: `sudo mv /usr/bin/rg /usr/bin/rg.bak`
2. Run the application
3. Verify it uses the bundled binary
4. Restore system ripgrep: `sudo mv /usr/bin/rg.bak /usr/bin/rg`

### Testing With Ripgrep Installed

To test system ripgrep usage:
1. Install ripgrep: `cargo install ripgrep` or use your package manager
2. Run the application
3. Check logs to verify it's using system ripgrep (if logging is enabled)

## Performance Considerations

### Why Ripgrep?

Ripgrep is chosen for its:
- **Speed**: Faster than grep, ag, ack
- **Unicode support**: Handles UTF-8 correctly
- **Smart filtering**: Respects .gitignore by default
- **JSON output**: Easy to parse programmatically
- **Cross-platform**: Works on Linux, macOS, Windows

### Binary Size

Ripgrep binaries are approximately:
- Linux: ~6 MB (musl static)
- macOS: ~4-5 MB
- Windows: ~5 MB

Total: ~20 MB for all platforms (not included in git repository)

### Search Performance

Expected performance:
- Small projects (<1000 files): <100ms
- Medium projects (1000-10000 files): <500ms
- Large projects (>10000 files): <2s

Performance depends on:
- Pattern complexity
- File size
- Disk I/O speed
- Number of matches

## Troubleshooting

### "Failed to execute ripgrep" Error

**Cause**: Ripgrep not found on system and sidecar binary missing.

**Solution**:
1. Run download script: `./download-ripgrep.sh`
2. Or install system ripgrep: `cargo install ripgrep`
3. Rebuild the application

### Permission Denied on Binary

**Cause**: Binary doesn't have execute permissions.

**Solution** (Linux/macOS):
```bash
chmod +x src-tauri/binaries/rg-*
```

### Binary Not Found After Build

**Cause**: Binary not included in bundle.

**Solution**:
1. Verify `tauri.conf.json` has `externalBin` configuration
2. Ensure binary exists in `binaries/` directory
3. Check binary naming matches platform convention

### Search Returns No Results

**Possible causes**:
1. Pattern doesn't match any files
2. Search path doesn't exist
3. Permissions issue
4. .gitignore filtering (ripgrep respects it by default)

**Debug**:
- Check the error message returned
- Try a simpler pattern
- Verify search path exists
- Test ripgrep directly: `rg --version`

## Security Considerations

1. **Input Validation**: Search patterns are passed directly to ripgrep. Malicious patterns could cause DoS via regex complexity.
   
   **Mitigation**: Consider adding pattern validation or timeout for searches.

2. **Path Traversal**: Search paths are user-provided.
   
   **Mitigation**: Validate paths are within expected directories before searching.

3. **Binary Integrity**: Sidecar binaries are downloaded from GitHub releases.
   
   **Mitigation**: Verify checksums when downloading binaries (future enhancement).

## Future Enhancements

Potential improvements:
- [ ] Add checksum verification for downloaded binaries
- [ ] Implement search cancellation
- [ ] Add search timeout configuration
- [ ] Cache search results for repeated queries
- [ ] Support for custom ripgrep configuration files
- [ ] Add progress reporting for large searches
- [ ] Implement search history

## References

- [Ripgrep GitHub Repository](https://github.com/BurntSushi/ripgrep)
- [Tauri Sidecar Documentation](https://tauri.app/v1/guides/building/sidecar/)
- [Ripgrep User Guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)

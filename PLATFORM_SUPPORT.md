# Platform Support for Ripgrep Integration

## Overview

The ripgrep integration in this application is **desktop-only**. Mobile platforms (Android and iOS) do not support the ripgrep functionality due to platform limitations.

## Supported Platforms

### ✅ Desktop Platforms (Fully Supported)
- **Linux** (x86_64)
- **macOS** (Intel x86_64 and Apple Silicon ARM64)
- **Windows** (x86_64)

On desktop platforms:
- Ripgrep functionality is fully available
- System ripgrep detection works
- Sidecar binary fallback is available
- All search commands work as expected

### ❌ Mobile Platforms (Not Supported)
- **Android**
- **iOS**

On mobile platforms:
- Ripgrep functionality is disabled at compile time
- Search commands return error messages
- No ripgrep binaries are bundled

## Why Mobile is Not Supported

Mobile platforms have several limitations that prevent ripgrep integration:

1. **No External Binaries**: Mobile platforms don't support running external binaries or sidecars
2. **Sandboxing**: Mobile apps are heavily sandboxed and cannot execute system commands
3. **Security**: iOS and Android don't allow apps to spawn arbitrary processes
4. **File System Access**: Limited file system access on mobile platforms
5. **Binary Size**: Adding ripgrep binaries for mobile would significantly increase app size

## Implementation Details

### Conditional Compilation

The code uses Rust's `cfg` attributes to conditionally compile code for different platforms:

```rust
// Desktop-only code
#[cfg(not(target_os = "android"))]
#[cfg(not(target_os = "ios"))]
pub fn search_files(...) -> Result<...> {
    // Desktop implementation with ripgrep
}

// Mobile stub
#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn search_files(...) -> Result<...> {
    Err("File search with ripgrep is not supported on mobile platforms".to_string())
}
```

### Affected Commands

The following Tauri commands are platform-specific:

1. **`search_files`**
   - Desktop: Full ripgrep-powered search
   - Mobile: Returns error

2. **`search_screenshots`**
   - Desktop: Full ripgrep-powered screenshot search
   - Mobile: Returns error

3. **`get_search_directories`**
   - Desktop: Works normally
   - Mobile: Works normally (no ripgrep dependency)

### Module Structure

- **`src/ripgrep.rs`**: Desktop-only module (conditionally compiled)
- **`src/search.rs`**: Contains both desktop and mobile implementations

## Frontend Handling

When building a cross-platform app, the frontend should:

1. **Check Platform**: Detect if running on mobile or desktop
2. **Graceful Degradation**: Provide alternative UI or disable search features on mobile
3. **Error Handling**: Handle error responses from search commands on mobile

### Example Frontend Code

```typescript
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';

async function performSearch(pattern: string) {
  const currentPlatform = platform();
  
  // Check if platform supports ripgrep
  if (currentPlatform === 'android' || currentPlatform === 'ios') {
    console.warn('Search not supported on mobile');
    return [];
  }
  
  try {
    return await invoke('search_files', {
      options: { pattern },
    });
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}
```

## Building for Different Platforms

### Desktop Build
```bash
# All ripgrep functionality included
pnpm tauri build
```

### Mobile Build
```bash
# Ripgrep functionality excluded, smaller binary
pnpm tauri android build
pnpm tauri ios build
```

The build system automatically:
- Excludes ripgrep module on mobile
- Doesn't bundle ripgrep binaries for mobile
- Uses mobile stub implementations

## Binary Size Impact

| Platform | With Ripgrep | Without Ripgrep | Savings |
|----------|--------------|-----------------|---------|
| Desktop  | ~20 MB       | N/A             | N/A     |
| Android  | N/A          | 0 MB            | ~20 MB  |
| iOS      | N/A          | 0 MB            | ~20 MB  |

## Alternative Solutions for Mobile

If file search is required on mobile, consider:

1. **Native Mobile APIs**: Use platform-specific file search APIs
2. **Simple File Walking**: Implement basic file walking in Rust
3. **Cloud-Based Search**: Offload search to a backend service
4. **Limited Search**: Implement a simple pattern matching without ripgrep

## Testing

### Testing Desktop Builds
```bash
# Should work normally
cargo test --target x86_64-unknown-linux-gnu
cargo test --target x86_64-apple-darwin
cargo test --target aarch64-apple-darwin
cargo test --target x86_64-pc-windows-msvc
```

### Testing Mobile Builds
```bash
# Should compile without errors, commands return errors
cargo build --target aarch64-linux-android
cargo build --target aarch64-apple-ios
```

## Migration Guide

If you previously had mobile builds with ripgrep:

1. Update frontend code to handle platform differences
2. Rebuild mobile apps with new code
3. Test that error handling works correctly
4. Update documentation for mobile users

## Future Considerations

Potential future enhancements:

- Implement lightweight search for mobile using native APIs
- Add feature flags to optionally enable simplified search on mobile
- Create platform-specific search implementations
- Add search result caching to improve performance

## Support

For questions or issues related to platform support:

1. Check if you're building for the correct platform
2. Verify conditional compilation is working
3. Review error messages from mobile commands
4. Consult the main documentation: `RIPGREP_INTEGRATION.md`

## Summary

- ✅ **Desktop**: Full ripgrep support with system detection and sidecar fallback
- ❌ **Mobile**: Not supported due to platform limitations
- 🔧 **Implementation**: Conditional compilation with stub implementations for mobile
- �� **Frontend**: Should detect platform and handle gracefully
- 📦 **Binary Size**: Mobile builds are ~20 MB smaller without ripgrep

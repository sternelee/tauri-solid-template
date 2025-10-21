# Raycast Components Build System

## 🏗️ Overview

This build system packages Raycast UI components for Shadow DOM rendering with comprehensive Vite-based tooling.

## 📁 Directory Structure

```
src/plugins/raycast/
├── build/
│   ├── package.template.json    # Package.json template
│   └── vite.config.ts          # Vite build configuration
├── scripts/
│   ├── build.js               # Main build script
│   ├── dev.js                 # Development server
│   └── package.js             # Package generator
├── src/
│   ├── index.ts               # Main entry point
│   ├── components/            # UI components
│   ├── shadow-dom-adapter.ts  # Shadow DOM integration
│   └── types.ts               # TypeScript definitions
└── dist/                      # Build output
```

## 🚀 Usage

### Development

```bash
# Start development server with hot reload
node scripts/dev.js

# Build once
node scripts/build.js

# Build with custom metadata
node scripts/build.js --metadata '{"name":"my-plugin","version":"1.2.3"}'
```

### Package Generation

```bash
# Generate all package variants
node scripts/package.js

# Generate specific templates
node scripts/package.js --templates basic,forms

# Build and pack for npm publishing
node scripts/package.js --pack --version 1.0.0
```

## 📦 Package Templates

### Basic Package
- Components: List, ListItem, Detail, Action
- Size: ~50KB gzipped
- Use case: Simple UI components

### Forms Package
- Components: Form, Form.TextField, Form.TextArea, Form.Dropdown
- Size: ~30KB gzipped
- Use case: Input forms and data collection

### Advanced Package
- Components: Grid, ActionPanel, ActionPanel.Section
- Size: ~40KB gzipped
- Use case: Complex layouts and actions

### Complete Package
- All components included
- Size: ~120KB gzipped
- Use case: Full-featured applications

## 🔧 Configuration

### Vite Configuration

The `build/vite.config.ts` provides:

- Multiple entry points (index, shadow-dom, components, types)
- ES and CommonJS output formats
- TypeScript declaration generation
- Tree-shaking optimization
- External dependency handling

### Build Scripts

- **build.js**: Main build pipeline with asset processing
- **dev.js**: Development server with file watching
- **package.js**: Multi-package generation with templates

### Package Template

The `build/package.template.json` defines:

- npm package metadata
- Dependency specifications
- Build scripts
- Export mappings
- TypeScript configuration

## 🎯 Output Formats

### ES Modules
```javascript
import { List, ListItem } from '@raycast/components';
```

### CommonJS
```javascript
const { List, ListItem } = require('@raycast/components');
```

### TypeScript Definitions
```typescript
import type { ListProps, ListItemProps } from '@raycast/components';
```

### Shadow DOM Bundle
```javascript
import { createComponentRenderer } from '@raycast/components/shadow-dom';
```

## 🔍 Build Process

1. **Clean**: Remove previous build artifacts
2. **Type Check**: Validate TypeScript types
3. **Bundle**: Process with Vite and plugins
4. **Generate**: Create package.json and documentation
5. **Copy**: Static assets and styles
6. **Manifest**: Generate component metadata

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

## 📋 Build Requirements

- Node.js 18+
- npm 9+
- TypeScript 5+
- Vite 5+

## 🚀 Performance Features

- **Tree Shaking**: Unused code elimination
- **Code Splitting**: Dynamic imports for large components
- **CSS Optimization**: Scoped styles and minification
- **Bundle Analysis**: Built-in bundle size tracking

## 🔧 Customization

### Adding New Components

1. Create component in `src/components/`
2. Add to component registry
3. Update type definitions
4. Add build entry point if needed

### Custom Build Options

```javascript
const buildOptions = {
  metadata: {
    name: '@my-org/components',
    version: '1.0.0',
    description: 'Custom component package'
  },
  components: ['List', 'Detail'], // Include only specific components
  minify: true,
  sourcemap: true
};
```

### Custom Templates

Create new package templates in `scripts/package.js`:

```javascript
const customTemplate = {
  name: '@my-org/custom-components',
  description: 'Custom component collection',
  includeComponents: ['CustomComponent1', 'CustomComponent2']
};
```

## 📊 Build Outputs

```
dist/
├── index.js           # ES module bundle
├── index.cjs          # CommonJS bundle
├── index.d.ts         # TypeScript definitions
├── shadow-dom.js      # Shadow DOM adapter
├── components.js      # Component factory
├── types.js           # Type definitions
├── style.css          # Component styles
├── assets/            # Static assets
├── package.json       # Generated package manifest
├── component-manifest.json  # Component metadata
└── type-mappings.json # Type definition mappings
```

## 🔄 CI/CD Integration

```yaml
# GitHub Actions example
- name: Build Components
  run: |
    npm ci
    node scripts/build.js
    node scripts/package.js --templates complete

- name: Upload Artifacts
  uses: actions/upload-artifact@v3
  with:
    name: component-packages
    path: packages/
```
#!/usr/bin/env node

// ============================================================================
// Raycast Components Development Server
// ============================================================================
// Development server for Raycast components with hot reload

import { watch } from 'chokidar';
import { build } from './build.js';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ============================================================================
// Development Configuration
// ============================================================================

const devConfig = {
  // Watch patterns
  watchPatterns: [
    join(rootDir, 'src/**/*.ts'),
    join(rootDir, 'src/**/*.tsx'),
    join(rootDir, 'src/**/*.css'),
    join(rootDir, 'src/**/*.scss'),
    join(rootDir, 'build/**/*'),
    join(rootDir, 'assets/**/*')
  ],

  // Ignore patterns
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**',
    '**/*.test.ts',
    '**/*.spec.ts'
  ],

  // Build options
  buildOptions: {
    metadata: {
      name: '@raycast/plugin-dev',
      version: '1.0.0-dev',
      description: 'Development build of Raycast components',
      keywords: ['development', 'preview'],
      raycastConfig: {
        componentType: 'ui',
        shadowDOM: true,
        apiVersion: '1.0.0',
        supportedPlatforms: ['macos', 'windows', 'linux'],
        development: true
      }
    }
  }
};

// ============================================================================
// Development Server
// ============================================================================

class DevServer {
  constructor(config) {
    this.config = config;
    this.watcher = null;
    this.isBuilding = false;
    this.buildQueue = [];
    this.startTime = Date.now();
  }

  async start() {
    console.log('🚀 Starting Raycast components development server...\n');

    // Initial build
    console.log('📦 Performing initial build...');
    await this.performBuild();
    console.log('✅ Initial build completed!\n');

    // Setup file watcher
    this.setupWatcher();

    // Setup server info display
    this.displayServerInfo();

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  setupWatcher() {
    console.log('👀 Setting up file watcher...');

    this.watcher = watch(this.config.watchPatterns, {
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('change', (filePath) => this.handleFileChange('changed', filePath))
      .on('add', (filePath) => this.handleFileChange('added', filePath))
      .on('unlink', (filePath) => this.handleFileChange('removed', filePath))
      .on('error', (error) => console.error('❌ Watcher error:', error));

    console.log('📁 Watching files:', this.config.watchPatterns.length, 'patterns');
  }

  handleFileChange(action, filePath) {
    const extension = extname(filePath);
    const relativePath = filePath.replace(rootDir, '');
    const timestamp = new Date().toLocaleTimeString();

    console.log(`\n📝 ${timestamp} - ${action.toUpperCase()}: ${relativePath}`);

    // Queue rebuild
    this.queueRebuild();
  }

  queueRebuild() {
    if (this.isBuilding) {
      this.buildQueue.push('rebuild');
      return;
    }

    this.isBuilding = true;
    this.performBuild().finally(() => {
      this.isBuilding = false;

      // Process queued rebuilds
      if (this.buildQueue.length > 0) {
        this.buildQueue = [];
        this.queueRebuild();
      }
    });
  }

  async performBuild() {
    const startTime = Date.now();
    console.log('🔨 Building...');

    try {
      await build(this.config.buildOptions);
      const duration = Date.now() - startTime;
      console.log(`✅ Build completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Build failed in ${duration}ms:`, error.message);
    }
  }

  displayServerInfo() {
    const uptime = Date.now() - this.startTime;
    const minutes = Math.floor(uptime / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);

    console.log(`
🎯 Raycast Components Development Server
   Running for: ${minutes}m ${seconds}s
   Output: ${join(rootDir, 'dist')}
   Watching: ${this.config.watchPatterns.length} file patterns

📋 Available commands:
   - Press Ctrl+C to stop the server
   - Files are automatically rebuilt on changes

📦 Build output:
   - ES modules: ./dist/index.js
   - CommonJS: ./dist/index.cjs
   - TypeScript definitions: ./dist/index.d.ts
   - Styles: ./dist/style.css
   - Package manifest: ./dist/package.json
`);
  }

  shutdown() {
    console.log('\n🛑 Shutting down development server...');

    if (this.watcher) {
      this.watcher.close();
    }

    console.log('👋 Development server stopped');
    process.exit(0);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

function printHelp() {
  console.log(`
Raycast Components Development Server

Usage:
  node dev.js [options]

Options:
  --help              Show this help message
  --watch <patterns>  Custom watch patterns (comma-separated)
  --ignore <patterns> Ignore patterns (comma-separated)
  --verbose           Verbose output

Examples:
  node dev.js
  node dev.js --watch "src/**/*.ts,src/**/*.css"
  node dev.js --ignore "**/*.test.ts,**/*.spec.ts"
`);
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
        printHelp();
        process.exit(0);

      case '--watch':
        i++;
        options.watchPatterns = args[i].split(',').map(pattern => join(rootDir, pattern));
        break;

      case '--ignore':
        i++;
        options.ignorePatterns = args[i].split(',');
        break;

      case '--verbose':
        options.verbose = true;
        break;

      default:
        console.error(`❌ Unknown option: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  // Merge options with default config
  const config = {
    ...devConfig,
    ...options
  };

  // Start development server
  const server = new DevServer(config);
  await server.start();
}

// Run the development server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export { DevServer };
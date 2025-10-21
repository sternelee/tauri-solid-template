#!/usr/bin/env node

// ============================================================================
// Raycast Components Package Generator
// ============================================================================
// Generates ready-to-publish packages for Raycast components

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { build } from './build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// ============================================================================
// Package Configuration
// ============================================================================

const packageConfig = {
  // Target platforms
  platforms: ['node'],

  // Output directory for packages
  outputDir: join(rootDir, 'packages'),

  // Package templates
  templates: {
    basic: {
      name: '@raycast/components-basic',
      description: 'Basic Raycast UI components',
      includeComponents: ['List', 'ListItem', 'Detail', 'Action']
    },
    forms: {
      name: '@raycast/components-forms',
      description: 'Form components for Raycast',
      includeComponents: ['Form', 'Form.TextField', 'Form.TextArea', 'Form.Dropdown']
    },
    advanced: {
      name: '@raycast/components-advanced',
      description: 'Advanced Raycast UI components',
      includeComponents: ['Grid', 'ActionPanel', 'ActionPanel.Section']
    },
    complete: {
      name: '@raycast/components-complete',
      description: 'Complete Raycast UI component library',
      includeComponents: 'all'
    }
  }
};

// ============================================================================
// Package Generator
// ============================================================================

class PackageGenerator {
  constructor(config) {
    this.config = config;
  }

  async generatePackages(options = {}) {
    console.log('📦 Generating Raycast component packages...\n');

    const templates = options.templates || Object.keys(this.config.templates);
    const results = [];

    for (const templateKey of templates) {
      const template = this.config.templates[templateKey];
      console.log(`🔨 Generating package: ${template.name}`);

      try {
        const result = await this.generatePackage(templateKey, template, options);
        results.push(result);
        console.log(`✅ Generated: ${result.name}@${result.version}\n`);
      } catch (error) {
        console.error(`❌ Failed to generate ${template.name}: ${error.message}\n`);
      }
    }

    this.printSummary(results);
    return results;
  }

  async generatePackage(templateKey, template, options) {
    const packageDir = join(this.config.outputDir, templateKey);
    const distDir = join(packageDir, 'dist');

    // Ensure directories exist
    mkdirSync(packageDir, { recursive: true });
    mkdirSync(distDir, { recursive: true });

    // Build the package
    const buildOptions = {
      metadata: {
        name: template.name,
        version: options.version || '1.0.0',
        description: template.description,
        keywords: ['raycast', 'ui-components', templateKey],
        raycastConfig: {
          componentType: 'ui',
          shadowDOM: true,
          apiVersion: '1.0.0',
          supportedPlatforms: ['macos', 'windows', 'linux'],
          template: templateKey,
          includedComponents: template.includeComponents
        }
      }
    };

    // Override build output directory
    const originalDistDir = this.config.distDir;
    this.config.distDir = distDir;

    try {
      await build(buildOptions);
    } finally {
      this.config.distDir = originalDistDir;
    }

    // Generate additional package files
    await this.generatePackageFiles(packageDir, template, buildOptions.metadata);

    // Run npm pack if requested
    if (options.pack) {
      await this.packPackage(packageDir);
    }

    return {
      name: template.name,
      version: buildOptions.metadata.version,
      template: templateKey,
      path: packageDir,
      distDir,
      components: template.includeComponents
    };
  }

  async generatePackageFiles(packageDir, template, metadata) {
    // Generate enhanced package.json
    await this.generateEnhancedPackageJson(packageDir, template, metadata);

    // Generate usage examples
    await this.generateUsageExamples(packageDir, template);

    // Generate CHANGELOG
    await this.generateChangelog(packageDir);

    // Generate LICENSE
    await this.generateLicense(packageDir);

    // Generate .npmignore
    await this.generateNpmIgnore(packageDir);
  }

  async generateEnhancedPackageJson(packageDir, template, metadata) {
    const packagePath = join(packageDir, 'package.json');
    const existingPackage = existsSync(packagePath)
      ? JSON.parse(readFileSync(packagePath, 'utf8'))
      : {};

    const enhancedPackage = {
      ...existingPackage,
      ...metadata,
      // Enhanced metadata
      repository: {
        type: 'git',
        url: 'https://github.com/raycast/component-packages.git',
        directory: template.name
      },
      bugs: {
        url: 'https://github.com/raycast/component-packages/issues'
      },
      homepage: `https://github.com/raycast/component-packages/tree/main/packages/${template.name}#readme`,
      // Component-specific metadata
      raycast: {
        componentType: 'ui',
        template: template.name,
        includedComponents: template.includeComponents,
        shadowDOM: true,
        apiVersion: '1.0.0'
      },
      // Development dependencies
      devDependencies: {
        ...existingPackage.devDependencies,
        '@types/node': '^20.0.0',
        'solid-js': '^1.8.0',
        'typescript': '^5.0.0',
        'vite': '^5.0.0'
      },
      // Files to include in npm package
      files: [
        'dist',
        'README.md',
        'LICENSE',
        'CHANGELOG.md',
        'examples/'
      ]
    };

    writeFileSync(packagePath, JSON.stringify(enhancedPackage, null, 2));
  }

  async generateUsageExamples(packageDir, template) {
    const examplesDir = join(packageDir, 'examples');
    mkdirSync(examplesDir, { recursive: true });

    const basicExample = `import { ${template.includeComponents.join(', ')} } from '${template.name}';
import { createComponentRenderer } from '${template.name}/shadow-dom';

// Example: Basic usage
function App() {
  return (
    <List>
      <ListItem
        title="Hello World"
        subtitle="This is a Raycast component"
        icon="🌍"
      />
    </List>
  );
}

// Render in Shadow DOM
const container = document.getElementById('app');
const renderer = createComponentRenderer(container, {
  pluginId: 'example-plugin',
  cssIsolation: 'strict'
}, raycastAPI);

renderer.render(App);
`;

    writeFileSync(join(examplesDir, 'basic.tsx'), basicExample);

    // Generate examples for each component
    for (const component of template.includeComponents) {
      if (component.includes('.')) continue; // Skip sub-components

      const componentExample = this.generateComponentExample(component, template.name);
      writeFileSync(join(examplesDir, `${component.toLowerCase()}.tsx`), componentExample);
    }
  }

  generateComponentExample(component, packageName) {
    const examples = {
      List: `import { List, ListItem } from '${packageName}';

function ListExample() {
  return (
    <List searchBarPlaceholder="Search items...">
      <ListItem
        title="Item 1"
        subtitle="First item description"
        icon="📝"
      />
      <ListItem
        title="Item 2"
        subtitle="Second item description"
        icon="📁"
      />
    </List>
  );
}`,

      Detail: `import { Detail } from '${packageName}';

function DetailExample() {
  return (
    <Detail
      markdown={\`
# Hello World

This is a **markdown** detail view.

## Features
- Markdown support
- Metadata display
- Action panels
      \`}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Version" text="1.0.0" />
          <Detail.Metadata.Label title="Author" text="Raycast Team" />
        </Detail.Metadata>
      }
    />
  );
}`,

      Form: `import { Form, Form.TextField, Form.Dropdown } from '${packageName}';

function FormExample() {
  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Submit" onAction={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Enter your name"
      />
      <Form.Dropdown
        id="category"
        title="Category"
        defaultValue="general"
      >
        <Form.Dropdown.Item value="general" title="General" />
        <Form.Dropdown.Item value="work" title="Work" />
      </Form.Dropdown>
    </Form>
  );
}`,

      Grid: `import { Grid, GridItem } from '${packageName}';

function GridExample() {
  return (
    <Grid columns={2} fit="contain">
      <GridItem
        title="Card 1"
        subtitle="Description for card 1"
        content="🎨"
      />
      <GridItem
        title="Card 2"
        subtitle="Description for card 2"
        content="🚀"
      />
    </Grid>
  );
}`,

      Action: `import { Action, ActionPanel } from '${packageName}';

function ActionExample() {
  return (
    <ActionPanel>
      <Action
        title="Copy to Clipboard"
        icon="📋"
        shortcut={{ modifiers: ["cmd"], key: "c" }}
        onAction={() => console.log("Copied!")}
      />
      <Action
        title="Open in Browser"
        icon="🌐"
        shortcut={{ modifiers: ["cmd"], key: "o" }}
        onAction={() => console.log("Opening...")}
      />
    </ActionPanel>
  );
}`
    };

    return examples[component] || `// Example for ${component} component
import { ${component} } from '${packageName}';

function ${component}Example() {
  return (
    <${component}>
      {/* Component content */}
    </${component}>
  );
}`;
  }

  async generateChangelog(packageDir) {
    const changelogContent = `# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial release of Raycast UI components
- Shadow DOM isolation support
- TypeScript definitions
- Tauri integration
- Component examples and documentation

### Features
- List components with search functionality
- Detail views with markdown support
- Form components with validation
- Grid layouts for responsive design
- Action panels with keyboard shortcuts
- Comprehensive TypeScript types
- Shadow DOM rendering with isolation
- Tauri API integration

### Documentation
- README with usage examples
- Component API documentation
- TypeScript definitions included
- Example implementations
`;

    writeFileSync(join(packageDir, 'CHANGELOG.md'), changelogContent);
  }

  async generateLicense(packageDir) {
    const licenseContent = `MIT License

Copyright (c) ${new Date().getFullYear()} Raycast

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

    writeFileSync(join(packageDir, 'LICENSE'), licenseContent);
  }

  async generateNpmIgnore(packageDir) {
    const ignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
*.tsbuildinfo

# Development files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Test files
*.test.ts
*.spec.ts
coverage/
.nyc_output/

# Documentation source
src/docs/
*.mdx

# Configuration files
vite.config.*
tsconfig.json
jest.config.*
.eslintrc.*
.prettierrc.*

# Scripts
scripts/
`;

    writeFileSync(join(packageDir, '.npmignore'), ignoreContent);
  }

  async packPackage(packageDir) {
    console.log(`📦 Packing ${basename(packageDir)}...`);

    try {
      execSync('npm pack', { cwd: packageDir, stdio: 'pipe' });
      console.log(`✅ Packed ${basename(packageDir)}`);
    } catch (error) {
      console.error(`❌ Failed to pack ${basename(packageDir)}: ${error.message}`);
    }
  }

  printSummary(results) {
    console.log('📊 Package Generation Summary\n');

    if (results.length === 0) {
      console.log('❌ No packages were generated');
      return;
    }

    results.forEach(result => {
      console.log(`✅ ${result.name}@${result.version}`);
      console.log(`   Template: ${result.template}`);
      console.log(`   Components: ${Array.isArray(result.components) ? result.components.join(', ') : 'All'}`);
      console.log(`   Path: ${result.path}`);
      console.log();
    });

    console.log(`🎉 Generated ${results.length} package(s) successfully!`);
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

function printHelp() {
  console.log(`
Raycast Components Package Generator

Usage:
  node package.js [options]

Options:
  --help              Show this help message
  --templates <list>  Comma-separated list of templates to generate
  --version <ver>     Version for generated packages
  --pack              Run npm pack after generation
  --verbose           Verbose output

Available templates:
  - basic: Basic UI components (List, ListItem, Detail, Action)
  - forms: Form components (Form, Form.TextField, Form.TextArea, Form.Dropdown)
  - advanced: Advanced components (Grid, ActionPanel, ActionPanel.Section)
  - complete: Complete component library

Examples:
  node package.js
  node package.js --templates basic,forms
  node package.js --version 1.2.3 --pack
  node package.js --templates complete --verbose
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

      case '--templates':
        i++;
        options.templates = args[i].split(',');
        break;

      case '--version':
        i++;
        options.version = args[i];
        break;

      case '--pack':
        options.pack = true;
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

  const generator = new PackageGenerator(packageConfig);
  await generator.generatePackages(options);
}

// Run the package generator if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export { PackageGenerator };
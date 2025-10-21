import { defineConfig } from 'vite';
import { resolve } from 'path';
import { solidPlugin } from 'vite-plugin-solid';
import { visualizer } from 'rollup-plugin-visualizer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [
      solidPlugin({
        solid: {
          // Solid.js configuration
          generate: 'dom',
          hydratable: false,
        },
      }),
      // Bundle analysis for development
      !isProduction && visualizer({
        filename: 'dist/bundle-analysis.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),

    // Build configuration
    build: {
      lib: {
        entry: {
          // Main entry point for the Raycast component library
          index: resolve(__dirname, '../src/index.ts'),
          // Shadow DOM adapter
          'shadow-dom': resolve(__dirname, '../src/shadow-dom-adapter.ts'),
          // Component exports
          components: resolve(__dirname, '../src/components/index.ts'),
          // Types exports
          types: resolve(__dirname, '../src/types.ts'),
        },
        name: 'RaycastComponents',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          const formatMap = {
            es: 'esm',
            cjs: 'cjs',
          };
          return `${entryName}.${formatMap[format]}.js`;
        },
      },

      rollupOptions: {
        external: [
          // External dependencies that should not be bundled
          'solid-js',
          'solid-js/web',
          '@solidjs/router',
          '@tauri-apps/api/core',
          '@tauri-apps/plugin-clipboard-manager',
          '@tauri-apps/plugin-fs',
          '@tauri-apps/plugin-os',
          '@tauri-apps/plugin-notification',
          '@tauri-apps/plugin-opener',
        ],

        output: {
          // Preserve module structure for better tree-shaking
          preserveModules: false,
          // Minify property names for production
          compact: isProduction,
          // Generate source maps
          sourcemap: !isProduction,
        },

        // Additional rollup options
        onwarn: (warning, warn) => {
          // Suppress certain warnings
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          if (warning.code === 'THIS_IS_UNDEFINED') return;
          if (warning.code === 'CIRCULAR_DEPENDENCY') return;
          warn(warning);
        },
      },

      // Target configuration
      target: 'es2020',
      minify: isProduction ? 'terser' : false,

      // CSS processing
      cssCodeSplit: false,

      // Chunk size warning
      chunkSizeWarningLimit: 1000,
    },

    // Resolve configuration
    resolve: {
      alias: {
        // Create aliases for cleaner imports
        '@': resolve(__dirname, '../src'),
        '@components': resolve(__dirname, '../src/components'),
        '@types': resolve(__dirname, '../src/types'),
        '@api': resolve(__dirname, '../src/api'),
        '@shadow': resolve(__dirname, '../src/shadow-dom'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },

    // Define global constants
    define: {
      __DEV__: !isProduction,
      __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },

    // CSS configuration
    css: {
      preprocessorOptions: {
        // Add support for CSS preprocessors if needed
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
        },
      },
      modules: {
        // CSS modules configuration
        localsConvention: 'camelCaseOnly',
      },
    },

    // Development server configuration (if needed)
    server: {
      port: 3001,
      host: true,
    },

    // Preview configuration
    preview: {
      port: 3002,
      host: true,
    },

    // Environment variables
    envPrefix: 'RAYCAST_',
  };
});
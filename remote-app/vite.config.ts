import { defineConfig } from 'vite';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  root: 'src', // Set your project root correctly if needed
  plugins: [
    federation({
      name: 'remote_app',
      filename: 'remoteEntry.js', // The entry file for exposing your modules
      exposes: {
        './AppComponent': './src/app/app.component.ts', // Path to Angular component or module
      },
      shared: [
        '@angular/core',
        '@angular/common',
        '@angular/router',
        '@angular/compiler',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
  preview: {
    port: 5001,
    strictPort: true,
    cors: true,
  },
  server: {
    cors: true,
    port: 5001,
  },
});

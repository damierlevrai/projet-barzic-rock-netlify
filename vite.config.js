import { defineConfig } from "vite";
import path from "path";
import { copyFileSync } from "fs";

export default defineConfig({
  root: ".",
  base: "./",
  publicDir: "public",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    
    rollupOptions: {
      // Configuration pour PWA
      output: {
        // Noms de fichiers avec hash pour cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },

  server: {
    port: 5173,
    open: true,
  },

  plugins: [
    // Plugin custom pour copier le Service Worker
    {
      name: 'copy-service-worker',
      closeBundle() {
        try {
          // Copier service-worker.js à la racine de dist
          copyFileSync(
            path.resolve(__dirname, 'service-worker.js'),
            path.resolve(__dirname, 'dist/service-worker.js')
          );
          
          // Copier sw-register.js dans dist
          copyFileSync(
            path.resolve(__dirname, 'sw-register.js'),
            path.resolve(__dirname, 'dist/sw-register.js')
          );
          
          console.log('✅ Service Worker copié dans dist/');
        } catch (error) {
          console.error('❌ Erreur copie Service Worker:', error);
        }
      }
    }
  ]
});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps every asset path relative, so the same build works on
// GitHub Pages (/let-we-cook/) and on any other static host.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  plugins: [react()],
});

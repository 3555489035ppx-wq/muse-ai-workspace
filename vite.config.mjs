import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  build: {
    outDir: "dist/client",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
    // BFF writes encrypted secrets and provider metadata here. Those runtime
    // writes are not source changes and must not reload the React tree while a
    // save/test request is updating its visible state.
    watch: {
      ignored: ["**/.muse-runtime/**"],
    },
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4176",
        changeOrigin: false,
      },
    },
  },
  plugins: [react()],
}));

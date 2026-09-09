import { defineConfig, type Plugin } from "vite";

const JSON_PATH = "/data/items.json";
const NETWORK_DELAY_MS = 750;

/** Holds the JSON response long enough that cache vs network is obvious in the demo. */
function delayBoardJson(): Plugin {
  return {
    name: "delay-board-json",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === JSON_PATH) {
          res.setHeader("Cache-Control", "no-store");
          setTimeout(next, NETWORK_DELAY_MS);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [delayBoardJson()],
  server: {
    host: "127.0.0.1",
    port: 43141,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 43141,
    strictPort: true,
  },
});

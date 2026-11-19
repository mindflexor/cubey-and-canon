import { defineConfig } from 'vite';
import { offlineGame } from './build/offline.js';
export default defineConfig({
  base: './',
  plugins: [offlineGame()],
  // no HMR/websocket: pages pick up edits on the next navigation instead of force-reloading mid-test
  server: { host: '127.0.0.1', port: 5173, strictPort: true, hmr: false, ws: false },
});

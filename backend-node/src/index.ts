import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';

import { PORT, VITE_DEV_PORT, STATIC_DIR } from './config.js';
import { setupWebSocket } from './websocket/handler.js';
import { ptyManager } from './pty/manager.js';
import { wsManager } from './websocket/manager.js';
import routes from './routes/index.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// API routes
app.use(routes);

// Static files or dev redirect
if (VITE_DEV_PORT) {
  app.get('*', (req, res) => {
    const host = req.hostname || '127.0.0.1';
    const protocol = req.protocol;
    res.redirect(307, `${protocol}://${host}:${VITE_DEV_PORT}${req.path}`);
  });
} else {
  // Serve static files if directory exists
  if (fs.existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(STATIC_DIR, 'index.html'));
    });
  }
}

// Create HTTP server
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  ptyManager.shutdown();
  wsManager.shutdown();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
server.listen(PORT, () => {
  console.log(`PocketCodex backend running on http://localhost:${PORT}`);
  if (VITE_DEV_PORT) {
    console.log(`Dev mode: Frontend at http://localhost:${VITE_DEV_PORT}`);
  }
});

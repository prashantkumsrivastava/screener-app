/* global process */
import express from 'express';
import path from 'path';
import { handleJsonDbApi } from './jsonDb.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Mount Custom JSON DB API routes
app.use(async (req, res, next) => {
  if (req.url.includes('/api/db/')) {
    const handled = await handleJsonDbApi(req, res);
    if (!handled && !res.headersSent) {
      next();
    }
  } else {
    next();
  }
});

// Serve static frontend build if dist directory exists
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  if (!req.url.startsWith('/api/')) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

app.listen(PORT, () => {
  console.log(`[JSON DB Server] Screener server listening on http://localhost:${PORT}`);
});


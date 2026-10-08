import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { renderUserCardPng, renderPodiumCardPng } from './src/server/renderer';

export { renderUserCardPng, renderPodiumCardPng };

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for external bot requests from fps.ms or any server
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Support JSON payloads with base64 images up to 20mb
  app.use(express.json({ limit: '20mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Telegram Bot Render Microservice',
      timestamp: new Date().toISOString()
    });
  });

  // API 1: Render VIP Gamer HUD Card PNG
  app.post('/api/render/user-card', (req, res) => {
    try {
      const pngBuffer = renderUserCardPng(req.body);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pngBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.end(pngBuffer);
    } catch (error) {
      console.error('Error rendering user card:', error);
      res.status(500).json({ error: 'Failed to render user card image', details: String(error) });
    }
  });

  // API 2: Render Olympic Championship Podium Card PNG
  app.post('/api/render/podium-card', (req, res) => {
    try {
      const pngBuffer = renderPodiumCardPng(req.body);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pngBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.end(pngBuffer);
    } catch (error) {
      console.error('Error rendering podium card:', error);
      res.status(500).json({ error: 'Failed to render podium card image', details: String(error) });
    }
  });

  // API 3: Group Live Dashboard Data
  app.get('/api/group/:groupId/dashboard', (req, res) => {
    const groupId = req.params.groupId;
    res.json({
      status: 'ok',
      groupId,
      timestamp: new Date().toISOString()
    });
  });

  // API 4: Global Bot Stats Data
  app.get('/api/bot/global-stats', (req, res) => {
    res.json({
      status: 'ok',
      totalGlobalMessages: 4289410,
      totalActiveGroups: 842,
      totalRegisteredUsers: 94250,
      timestamp: new Date().toISOString()
    });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

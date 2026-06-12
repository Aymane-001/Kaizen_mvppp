const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const PORT = process.env.FRONTEND_PORT || 3000;
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');
const BIND = process.env.FRONTEND_BIND || '0.0.0.0';

if (!fs.existsSync(FRONTEND_DIR)) {
  console.error('Frontend dir missing:', FRONTEND_DIR);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "blob:"],
      "media-src": ["'self'", "blob:"],
      "connect-src": ["'self'", "http:", "https:", "ws:", "wss:"],
      "frame-ancestors": ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const ALLOWED = new Set(['.html', '.css', '.js', '.svg', '.png', '.ico', '.webmanifest', '.json']);

app.get('*', (req, res) => {
  let rel = decodeURIComponent(req.path);
  if (rel.includes('..') || rel.includes('\0')) return res.status(400).end();
  if (rel === '/' || rel === '') rel = '/index.html';

  const full = path.join(FRONTEND_DIR, rel);
  if (!full.startsWith(FRONTEND_DIR)) return res.status(403).end();

  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }

  const ext = path.extname(full).toLowerCase();
  if (!ALLOWED.has(ext)) {
    return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }

  if (!fs.existsSync(full)) {
    return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }

  res.sendFile(full);
});

app.listen(PORT, BIND, () => {
  console.log('');
  console.log('  kaizen frontend  ·  http://' + BIND + ':' + PORT);
  console.log('  serving          ·  ' + FRONTEND_DIR);
  console.log('  directory listing: disabled');
  console.log('');
});

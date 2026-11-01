import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const database = openDatabase();
const app = createApp(database);
const distDirectory = path.resolve(serverDirectory, '../dist');

app.use(express.static(distDirectory));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/health/')) return next();
  return res.sendFile(path.join(distDirectory, 'index.html'));
});

const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`AbhiNexus listening on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}

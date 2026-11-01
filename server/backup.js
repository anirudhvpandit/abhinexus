import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(serverDirectory, '../data/abhinexus.db'));
const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = path.resolve(process.argv[2] || path.join(path.dirname(databasePath), 'backups', `abhinexus-${timestamp}.db`));

if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
  throw new Error(`Database file does not exist: ${databasePath}`);
}
if (destination === databasePath) {
  throw new Error('Backup destination must differ from the live database path.');
}
if (fs.existsSync(destination)) {
  throw new Error(`Backup destination already exists: ${destination}`);
}

fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
const database = openDatabase(databasePath);

try {
  await database.backup(destination);
  fs.chmodSync(destination, 0o600);
  console.log(`Database backup created: ${destination}`);
} catch (error) {
  console.error('Database backup failed:', error.message);
  process.exitCode = 1;
} finally {
  database.close();
}

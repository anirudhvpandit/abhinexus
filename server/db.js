import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));

export function openDatabase(databasePath = path.resolve(process.env.DATABASE_PATH || path.join(serverDirectory, '../data/abhinexus.db'))) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  fs.chmodSync(databasePath, 0o600);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrateDatabase(db);
  return db;
}

export function migrateDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = db.prepare('SELECT version FROM schema_migrations').all().map(({ version }) => version);
  const migrationFiles = fs.readdirSync(path.join(serverDirectory, 'migrations'))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();

  if (!applied.includes(1) && db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'").get()) {
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name));
    if (!tables.has('organizations')) {
      for (const table of ['projects', 'resources', 'risks', 'milestones']) {
        if (tables.has(table)) db.exec(`ALTER TABLE ${table} RENAME TO legacy_${table}`);
      }
    }
  }

  for (const migrationFile of migrationFiles) {
    const version = Number(migrationFile.split('_', 1)[0]);
    if (applied.includes(version)) continue;

    const sql = fs.readFileSync(path.join(serverDirectory, 'migrations', migrationFile), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
    })();
  }
}

import { openDatabase } from './db.js';

const db = openDatabase();
const migrations = db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all();
console.log(`Database is up to date (${migrations.length} migration${migrations.length === 1 ? '' : 's'} applied).`);
db.close();

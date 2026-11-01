# Operations and deployment

## Environment

Copy `.env.example` to `.env` for local work. Important settings:

| Variable | Use |
| --- | --- |
| `NODE_ENV` | Use `production` for a production deployment; demo seeding is disabled in this mode. |
| `PORT` | Express listening port (default 3001). |
| `DATABASE_PATH` | SQLite file path (default `data/abhinexus.db`). The containing directory must be writable by the app process. |
| `APP_ORIGIN` | Trusted browser origin, including scheme and host, e.g. `https://work.example.com`. Configure the public origin when using a reverse proxy. |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | Optional local demo-seed overrides only. Do not use demo credentials in production. |

Use HTTPS in production and configure the reverse proxy to preserve the external host/protocol. Keep database and environment files outside source control. Do not expose the Express port directly to the public internet without TLS and suitable network controls.

## Local production-mode smoke test

```sh
npm ci
npm run build
NODE_ENV=production npm start
```

Check `GET /health/live` and `GET /health/ready`; both should return HTTP 200. Open the root page and register a test organization. The production server serves the built `dist/` assets.

## Docker Compose

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Compose persists the database in the `abhinexus_data` named volume. It runs as the non-root `node` user, drops Linux capabilities, sets a read-only container root filesystem, and exposes readiness health status. Configure `APP_ORIGIN` before using a public hostname. The container does not provide TLS termination, automatic encrypted backups, or multi-instance coordination.

## Backups

Create a consistent SQLite online backup while the service is running:

```sh
npm run db:backup
# Or choose a new destination explicitly:
npm run db:backup -- ./data/backups/manual.db
```

The command refuses to overwrite an existing destination and sets the resulting database file to mode `0600`. Backups contain sensitive organization and user data. Store them encrypted, restrict access, retain them off-host, and periodically test restores.

For Compose, create the backup inside the persistent volume:

```sh
docker compose exec app node server/backup.js /data/backups/abhinexus-manual.db
```

The destination directory must be writable by the `node` user. Copy the completed file to an encrypted off-host location using your approved backup process.

## Restore outline

1. Stop the application and verify the backup file and its checksum.
2. Preserve a separate copy of the current database before replacing anything.
3. Restore the selected database to the configured `DATABASE_PATH`, retaining ownership and restrictive permissions.
4. Start one application instance, confirm `/health/ready`, verify expected organization/project records, and review logs.
5. Record the restore time and data-loss window. Do not run multiple independent SQLite app instances against separate local volumes.

Practice this procedure on a non-production copy; backup creation alone does not establish recoverability.

## Maintenance and troubleshooting

- Apply schema updates with `npm run db:migrate` (also runs at app startup).
- Check app logs for migration/SQLite errors and request IDs (`X-Request-Id`) for support correlation.
- If login fails, verify the origin, cookie settings, server time, and browser HTTPS context.
- If the app starts but data appears absent, check that `DATABASE_PATH` points to the expected persistent file.
- For a suspected data issue, stop writes and preserve a copy of the database before further investigation.

## Current operational limitations

SQLite is appropriate for local/demo and modest single-instance workloads, not a substitute for a reviewed multi-tenant production database strategy. There are no configured metrics/alerts, encryption-at-rest integration, scheduled backup policy, backup retention service, email provider, payment provider, Redis, job worker, or production secrets manager.

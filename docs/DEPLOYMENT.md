# Deployment

## Supported paths in this repository

### Single-process Node deployment

Requirements: Node 22 LTS (or Node 20.19+), a writable persistent directory, and HTTPS termination at a trusted proxy/load balancer.

```sh
npm ci
npm run build
NODE_ENV=production PORT=3001 DATABASE_PATH=/var/lib/abhinexus/abhinexus.db \
APP_ORIGIN=https://work.example.com npm start
```

Persist and back up the directory containing the SQLite database. Run one application process against a local SQLite file; do not attach separate local database copies to several replicas.

### Docker Compose

```sh
APP_ORIGIN=https://work.example.com docker compose up --build -d
docker compose ps
docker compose logs -f app
```

The Compose file publishes port 3001 (or `PORT`), stores data in the `abhinexus_data` volume, runs a non-root process, drops capabilities, and uses a read-only root filesystem. Terminate TLS outside the container and route the public origin to the service. Compose is a deployment template, not a managed production platform.

## Pre-deployment

1. Configure production `NODE_ENV` and public `APP_ORIGIN`; verify `.env` and secrets are not in the image or repository.
2. Build from the lockfile and run tests/lint/build.
3. Configure persistent storage, ownership, off-host encrypted backups, restore procedures, monitoring, and log retention.
4. Decide how deployments apply migrations and preserve an immediate rollback backup.
5. Remove or avoid seeding demo data; never use documented local demo credentials in production.
6. Review TLS, proxy headers, cookie behavior, origin allowlist, network exposure, and app resource limits.

## Health and rollout

- `GET /health/live`: process is responding.
- `GET /health/ready`: SQLite can execute a query.
- Check service logs and request IDs after rollout. Verify the app root and one authorized API request.
- Roll back the application artifact if needed. Database rollback requires a tested backup/restore procedure; do not assume an older application can read a newer schema.

## Not supplied

This repository does not provision cloud infrastructure, TLS, a reverse proxy, secrets, database encryption, automated backups, metrics/alerts, blue-green rollout, or high availability. Use [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) for operational procedures and known limitations.

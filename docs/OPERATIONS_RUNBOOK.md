# Operations runbook

## Service checks

1. Confirm the Node process/container is running.
2. Request `/health/live`; a 200 response confirms the web process responds.
3. Request `/health/ready`; a 200 response confirms the database can be queried.
4. Check logs for startup/migration errors and use `X-Request-Id` to correlate a report.
5. Confirm the browser-visible URL, `APP_ORIGIN`, and database path are expected.

## Common incidents

| Symptom | First response |
| --- | --- |
| `npm: command not found` | Install Node.js 22 LTS or load nvm in zsh with `source ~/.nvm/nvm.sh`; verify `node --version` and `npm --version`. |
| App starts with no expected data | Check `DATABASE_PATH`, persistent-volume mount, and which environment file/process is active. Preserve the DB before changing paths. |
| Login/session fails | Check user/org membership, server time, HTTPS/Secure cookie configuration, browser-visible origin, and app logs. Avoid disabling origin checks as a workaround. |
| SQLite busy/locked or disk full | Check that only one service instance is writing to the local DB, inspect disk capacity, preserve the DB, and follow the storage provider's safe remediation process. |
| Suspected tenant/finance access issue | Restrict access, preserve relevant request IDs and logs, reproduce with a test account/database, and invoke the incident process. Do not send customer records in chat/issues. |
| Failed deployment/migration | Stop rollout, preserve current DB and logs, restore a known-good copy only after approval; migrations are not automatically reversible. |

## Backup

For Node deployments:

```sh
npm run db:backup
npm run db:backup -- /secure-backup-path/abhinexus-copy.db
```

For Compose:

```sh
docker compose exec app node server/backup.js /data/backups/abhinexus-copy.db
```

The tool creates a consistent SQLite backup, refuses an existing destination, and restricts file mode. Copy to approved encrypted off-host storage, track backup time/checksum, and alert on missed backup operations. No scheduler or off-site integration is included.

## Restore

1. Declare/record the incident and stop writes.
2. Preserve a copy of the current data and select a verified backup.
3. Restore only to the configured path after confirming ownership/permissions.
4. Start one instance and check readiness, tenant/project counts, and sampled records.
5. Re-enable traffic after product owner approval; record the restore point and estimated data-loss interval.
6. Test restore regularly in a separate environment. Do not practice against live customer data.

## Maintenance

- Apply migrations through application startup or `npm run db:migrate`.
- Deploy a single application instance for local SQLite.
- Do not delete session/legacy/audit rows manually without an approved retention/data-handling procedure.
- Rotate credentials through the applicable provider; reset the local demo account with the dedicated seed reset command only in a local/demo database.

This is a starter runbook. Assign named on-call owners, escalation paths, SLOs, alert thresholds, retention periods, and recovery-time objectives before production use.

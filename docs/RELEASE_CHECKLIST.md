# Release checklist

## Code and product

- [ ] Confirm scope/version and known limitations; update the PRD and release notes.
- [ ] Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`.
- [ ] Review task schedule/dependency rules, role gates, tenant scoping, finance redaction, CSV output, and migrations.
- [ ] Manually test primary workflows on supported browsers and mobile widths; check keyboard and screen-reader access.
- [ ] Verify synthetic demo labels and never mix demo metrics into customer organizations.
- [ ] Review dependency changes, secrets, generated files, error handling, and database migration compatibility.

## Security and operations

- [ ] Set `NODE_ENV=production`, public `APP_ORIGIN`, TLS, secrets, and persistent database path.
- [ ] Ensure production database contains no demo user or seed data; confirm seed script refuses production mode.
- [ ] Run authorization tests for every sensitive route/role and cross-organization reads/writes.
- [ ] Take a pre-release backup and verify a restore in a separate environment.
- [ ] Confirm logs/monitoring, health checks, capacity limits, incident escalation, and rollback owner.
- [ ] Review data retention, deletion, privacy, and customer-support access.

## Commercial readiness

- [ ] Validate pricing/packaging and target customer profile; do not publish unvalidated price hypotheses as commitments.
- [ ] Configure real email, payment, support, terms, privacy, and billing workflows or clearly state they are unavailable.
- [ ] Secure approval for any claims about security, compliance, customer outcomes, or service availability.

## Sign-off record

Record release identifier, date, test/build status, migration version, backup reference, known issues, approvers, and rollback decision in the release system used by the deployment team. This template does not imply a release has been approved.

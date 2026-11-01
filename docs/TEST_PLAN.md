# Test plan

## Automated suite

Run:

```sh
npm test
npm run lint
npm run build
```

`npm test` uses Node's built-in test runner, a temporary SQLite database per integration test, and an ephemeral HTTP port. It currently exercises:

- Registration, login, logout, session protection, and unauthenticated responses.
- Organization isolation and role restrictions, including finance redaction and write denial.
- Portfolio/project/task workflows, pagination, dependency cycle detection, date constraints, and no cross-project task movement with dependencies.
- Resource capacity overlap validation and finance variance calculation.
- Risk scoring, in-app critical-risk notifications, CSV formula mitigation, and dashboard blocked-task counts.
- Versioned migration preserving legacy tables.
- Demo seed/reset, synthetic provenance, valid dependency dates, production guard.
- Online SQLite backup contents and private file permissions.

## Manual acceptance checks

1. Register a workspace and confirm only its owner can access it.
2. Create portfolios, projects, tasks, dependencies, milestones, resources, assignments, financial entries, and risks.
3. Confirm a task with unfinished prerequisites cannot be completed and cannot be scheduled before its prerequisite.
4. Confirm a resource cannot exceed 100% overlapping allocation.
5. Sign in as a contributor and verify budget/actual/forecast values are absent; verify finance routes reject the role.
6. Export portfolio/risk CSV and open in a spreadsheet; verify values are treated as text and the export contains only authorized organization data.
7. Create a high-risk item and verify an in-app notification for privileged members.
8. Restart the server and verify records persist. Create a backup and test restore in a separate non-production database.
9. Run production-mode smoke checks for root, `/health/live`, `/health/ready`, registration/login, and browser cookies over HTTPS at the actual deployment origin.

## Not covered yet

The current tests do not provide full route/role matrix coverage, browser automation in CI, load/concurrency tests, accessibility audit, email/billing/integration tests, multi-instance tests, backup-retention verification, or third-party penetration testing. Passing the suite is not equivalent to production certification.

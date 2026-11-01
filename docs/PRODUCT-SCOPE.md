# Product scope and readiness

## Delivered in this MVP

| Area | Current behavior |
| --- | --- |
| Workspace setup | Registration creates an organization, owner membership, first strategic portfolio, and trial record. Synthetic demo seed is development-only. |
| Portfolio and projects | Tenant-scoped portfolio/project CRUD, project health, lifecycle, schedule, priority, budget, search, filters, sorting, and pagination. |
| Tasks | Create/update/delete, status, priority, assignee, effort, dates, pagination, and same-project finish-to-start dependencies. API rejects cycles, prerequisite violations, and invalid schedule changes. |
| Milestones | Create/update and status tracking. |
| Resources | Resource list and time-bounded assignments; overlapping allocation above 100% is rejected. |
| Finance | Integer-cent budget, actual, and forecast values; role-gated financial summaries, entries, and CSV report. Variance is approved budget minus actual or forecast. |
| Risk | 1–5 probability and impact scoring, residual score, owner, mitigation/contingency, status, review date, escalation, and CSV export. |
| Reports | Dashboard KPIs, action items, print stylesheet, portfolio CSV, and risk-register CSV. |
| Security foundation | Scrypt password hashes, opaque hashed session tokens, HttpOnly/SameSite cookies, role checks, tenant-qualified queries, authentication rate limits, origin checks, security headers, audit records, and finance-field redaction. |
| Persistence | SQLite with foreign keys, WAL, busy timeout, versioned schema migrations, legacy-table preservation, and an online backup command. |

## Partial or intentionally simplified

- Roles are fixed application roles; there is no UI for a custom permission matrix or changing member roles.
- Organization registration is self-serve. Invitations, email verification, password reset, and all email delivery are not implemented.
- Task dependencies are finish-to-start only. No Gantt editor, critical-path calculation, task comments, attachments, or task activity feed.
- Resource availability is weekly hours plus percentage assignments. There are no leave calendars, working-day calendars, skill matrices, or capacity plans.
- Milestone and risk updates are basic. There is no approval workflow, issue register, risk history, or configurable scoring thresholds.
- Notifications are in-app records only; notification preferences, scheduled jobs, and email/push delivery are not configured.
- Reporting includes CSV and browser printing, not native Excel/PDF generation.
- The database supports one application instance with a local SQLite file. Horizontal scaling, MySQL/PostgreSQL, Redis, object storage, and job queues are outside this MVP.
- Subscription records are initialized for new organizations. Billing UI is a development simulator, not a payment integration.

## External and operational launch gates

Before a real commercial launch, choose and configure production identity/email and billing providers; production hosting and database; TLS, domain, and proxy settings; secrets management; monitoring/alerting; encrypted off-site backup retention and restore drills; privacy, data retention, and deletion policy; legal terms; accessibility review; and incident-response ownership.

Enterprise items from the originating brief—SSO, SCIM, advanced audit controls, external integrations, and scale-out infrastructure—require separate design and provider choices. Do not represent these as available features until implemented and tested.

## Suggested acceptance gates

1. Automated tests cover every authorization role and every organization-scoped route, including negative cross-tenant cases.
2. A production identity and mail flow exists for verification, recovery, and invitations; security controls and abuse monitoring are reviewed.
3. Automated encrypted backups have retention, monitoring, and a demonstrated restore procedure.
4. Deployment has TLS, durable storage, error monitoring, resource limits, vulnerability/dependency review, and a documented incident process.
5. Finance and billing behavior has been reviewed against accounting, tax, currency, and payment-provider requirements.
6. Usability, keyboard navigation, accessibility, browser compatibility, and data import/export have been validated with representative customers.

# Architecture and data model

## Runtime

- React 19, TypeScript, Vite, Tailwind, TanStack Query, and Recharts provide the single-page workspace.
- Express 5 serves `/api/v1` and production static assets. During development, Vite proxies `/api` and health requests to Express.
- SQLite is accessed through `better-sqlite3`; schema changes live in `server/migrations/` and are applied at startup.
- Zod validates request bodies. Role middleware protects writes and sensitive reads. Queries scope records to the authenticated organization.

## Main entities

`organizations` owns `memberships`, `organization_settings`, subscriptions, portfolios, projects, resources, notifications, and audit events. Users can have memberships in multiple organizations. Projects can belong to portfolios and own tasks, milestones, risks, financial entries, and assignments. Task dependencies reference two tasks in the same organization. Composite organization-aware foreign keys prevent accidental cross-tenant relations.

Most mutable records use UUIDs and ISO-8601 timestamps. Dates are stored as ISO calendar dates. Money is stored as integer minor units with an organization currency; currency changes do not perform conversion.

## Authentication and authorization

Registration and login issue random bearer tokens in HttpOnly, SameSite cookies. Only a SHA-256 digest of each token is stored in the session table; passwords are salted and hashed with Node's scrypt. Unsafe requests validate the browser origin when provided. Authentication endpoints use a rate limit.

Organization scope is taken from the authenticated session and applied to data reads/writes. The organization-switch endpoint verifies membership before replacing the session's organization. Roles are `owner`, `admin`, `portfolio_manager`, `project_manager`, `team_lead`, `contributor`, `finance_viewer`, and `executive_viewer`. Financial fields are omitted from project and dashboard payloads for roles that cannot read finance.

This is a security foundation, not a third-party security certification. A production launch still requires threat modeling, deployment review, monitoring, secret management, penetration testing, and operational controls.

## API outline

Base path: `/api/v1`.

| Resource | Routes / behavior |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/switch-organization` |
| Portfolio | `GET/POST /portfolios`, `PATCH/DELETE /portfolios/:id` |
| Projects | `GET/POST /projects`, `PATCH/DELETE /projects/:id` with page, limit, query, status, portfolio, and sort filters |
| Tasks | `GET/POST /tasks`, `PATCH/DELETE /tasks/:id`, `POST /tasks/:id/dependencies`; GET returns `{items,total,page,limit}` |
| Delivery | `GET/POST /milestones`, `PATCH /milestones/:id`, `GET/POST /resources`, `POST /assignments` |
| Finance and risk | `GET /finance`, `POST /finance/entries`, `GET/POST /risks`, `PATCH /risks/:id` |
| Workspace and reporting | `GET /dashboard`, `GET /search`, `GET /notifications`, `PATCH /notifications/:id/read`, CSV report routes, admin settings/members/audit routes |
| Health | `GET /health/live`, `GET /health/ready` |

Endpoint-level schemas, permissions, and status codes are defined in `server/app.js`. Export endpoints are authenticated. CSV values are escaped to reduce spreadsheet formula execution.

## Important behavior

- Task links support finish-to-start only. A task cannot be completed before prerequisites; schedule edits must preserve prerequisite dates. Dependency cycle checks use a recursive query.
- Assignment percentages are summed over overlapping calendar dates and may not exceed 100% of configured weekly capacity.
- Project actual/forecast totals prefer matching financial-entry sums when entries exist; otherwise they use project-level recorded values.
- Risk scores are probability × impact. Finance and risk CSVs inherit the same tenant and permission checks as their source data.
- The development subscription simulator must not be used as evidence of billing integration.

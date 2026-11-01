# API reference

Base URL in development: `http://localhost:3001/api/v1`. Production uses the same-origin `/api/v1` path. JSON request bodies are limited to 1 MB and validated by Zod. Authenticated requests use the HttpOnly `abhinexus_session` cookie; browser clients should use same-origin requests.

## Response conventions

- Lists: resources without pagination currently return JSON arrays.
- Paginated projects/tasks: `{ "items": [], "total": 0, "page": 1, "limit": 25 }`. Maximum page size is 100. Tasks optionally accept `project_id`.
- Validation failures return 400 with a short `error`; selected schemas include field details.
- Unauthenticated requests return 401; forbidden role/origin returns 403; missing or cross-organization IDs return 404; workflow conflicts return 409.
- Dates use `YYYY-MM-DD`; timestamps are ISO-8601; monetary input uses integer cents.

## Routes

| Method and path | Access | Notes |
| --- | --- | --- |
| `POST /auth/register` | Public, rate-limited | Creates owner, organization, first portfolio, trial record, and session. |
| `POST /auth/login` | Public, rate-limited | Issues a new session cookie. |
| `POST /auth/logout` | Authenticated | Revokes current session. |
| `GET /auth/me` | Authenticated | Current user, organization, role, memberships. |
| `POST /auth/switch-organization` | Authenticated | Switches only to an existing membership. |
| `GET /organizations` | Authenticated | Organizations available to current user. |
| `GET/POST /portfolios` | Read: authenticated; write: owner/admin/portfolio manager | Portfolio list and create. |
| `PATCH/DELETE /portfolios/:id` | Owner/admin/portfolio manager | Update or remove portfolio; project links are detached on delete. |
| `GET/POST /projects` | Read: authenticated; write: owner/admin/portfolio/project manager | List filters: `page`, `limit`, `q`, `status`, `portfolio_id`, `sort`. |
| `PATCH/DELETE /projects/:id` | Owner/admin/portfolio/project manager | Update or remove project. |
| `GET /tasks` | Authenticated | Filters: `page`, `limit`, optional `project_id`; returns paginated shape. |
| `POST /tasks` | Owner/admin/portfolio/project manager/team lead | Creates task. |
| `PATCH /tasks/:id` | Owner/admin/portfolio/project manager/team lead | Updates task; validates schedule and prerequisites. |
| `DELETE /tasks/:id` | Owner/admin/portfolio/project manager | Deletes task. |
| `POST /tasks/:id/dependencies` | Owner/admin/portfolio/project manager/team lead | Body `{ "predecessor_id": "uuid", "dependency_type": "FS" }`. Same-project FS only. |
| `GET/POST /milestones` | Read: authenticated; write: owner/admin/portfolio/project manager/team lead | Milestone list and create. |
| `PATCH /milestones/:id` | Owner/admin/portfolio/project manager/team lead | Update name, date, or status. |
| `GET /resources` | Authenticated | Resources and current-period assignments. |
| `POST /resources`, `POST /assignments` | Owner/admin/portfolio manager/team lead | Adds resource or date-bounded percentage assignment. |
| `GET /finance` | Owner/admin/portfolio manager/finance viewer/executive viewer | Finance summaries, entries, and currency. |
| `POST /finance/entries` | Owner/admin | Add actual/forecast entry. |
| `GET /risks` | Authenticated | Organization risk register. |
| `POST /risks` | Owner/admin/portfolio/project manager/team lead | Creates risk. |
| `PATCH /risks/:id` | Owner/admin/portfolio/project manager/team lead | Updates risk. |
| `GET /dashboard` | Authenticated | KPIs, safe project rows, and action items. Finance fields are role-gated. |
| `GET /search` | Authenticated | Organization-scoped project/task/portfolio search. |
| `GET /reports/portfolio.csv` | Owner/admin/portfolio manager/finance viewer/executive viewer | Finance-bearing CSV. |
| `GET /reports/risk-register.csv` | Owner/admin/portfolio manager/executive viewer | Risk CSV. |
| `GET /notifications`, `PATCH /notifications/:id/read` | Authenticated, own notifications | Lists or marks current user's notification read. |
| `GET /members`, `GET /roles` | Owner/admin | Organization members and fixed role permissions. |
| `GET /admin/audit`, `GET/PATCH /settings` | Owner/admin | Audit records and organization settings. |
| `GET /subscription`, `PATCH /subscription/plan` | Read: authenticated; write: owner/admin | Development metadata only; no real billing. |
| `GET /health/live`, `GET /health/ready` | Public | Liveness and database readiness. |

For exact accepted fields, defaults, and validation rules, see the route schemas in `server/app.js`; this reference summarizes the implemented surface, not a generated OpenAPI contract.

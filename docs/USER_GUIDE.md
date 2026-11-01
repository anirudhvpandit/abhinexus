# User guide

## Sign in or create a workspace

Open the application URL. Create a workspace with your name, work email, organization name, and a 12-character minimum password, or sign in with an existing account. Registration creates an owner account and a starter portfolio. Use the local demo credentials only for a seeded development workspace.

## Navigate the workspace

- **Overview:** organization KPIs, portfolio health, risk and milestone action items.
- **Portfolios:** group projects around a strategic objective.
- **Projects:** search, filter, sort, inspect, create, and update projects.
- **Tasks & Work:** create tasks, assign owners/effort/dates, update status, add finish-to-start prerequisites, and page through task lists.
- **Roadmap:** review project milestones and update milestone dates/status.
- **Resources:** maintain resource records and make date-bounded percentage assignments.
- **Financials:** inspect approved budget, actual entries, and forecasts if your role permits.
- **Risks & Issues:** record risk probability/impact, owner, mitigation, contingency, residual assessment, status, and escalation.
- **Reports:** review current portfolio data, print a browser-friendly summary, or export CSV.
- **Notifications:** view and mark your own in-app notices read.
- **Settings/Admin:** owner/admin access to organization settings, membership/role visibility, and audit history.

## Add a project

Create a portfolio first if needed. Add a project with name, code, priority, lifecycle stage, owner, dates, progress, and budget if your role can write financial values. Store project dates consistently; the API rejects target dates before start dates.

## Task dependencies

Create the prerequisite task and successor in the same project. Use **Link** on the successor and choose a prerequisite. Only finish-to-start is supported. A task may show “Blocked by unfinished prerequisite” even while its saved status remains Todo/In Progress; the API also prevents completion before the prerequisite is Done.

## Finance and risk

Amounts are entered/stored in integer cents through the API and presented in the organization currency. Budget variance is approved budget minus actual; forecast variance is approved budget minus forecast. No currency conversion occurs if the organization currency changes.

Risk probability and impact use 1–5 scales; score is their product. Set an owner, mitigation, contingency, and review date so the record can be acted upon.

## Roles

The fixed roles are owner, admin, portfolio manager, project manager, team lead, contributor, finance viewer, and executive viewer. Financial reads and writes are separately restricted. Administrators can inspect the role permission matrix in the application. There is no custom-role editor or invitation workflow yet.

## Demo-data warning

The demo organization contains synthetic names, projects, dates, budgets, risks, and assignments. Do not present its metrics as customer outcomes. To discard and recreate the isolated demo workspace, use `npm run db:seed:demo:reset` only against a local/demo database.

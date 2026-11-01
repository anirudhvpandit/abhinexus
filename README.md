# AbhiNexus

AbhiNexus is an organization-scoped portfolio and project management MVP. It combines portfolio oversight, project delivery, task dependencies, resource allocation, financial tracking, risk registers, and CSV/printable reporting in one workspace.

## Run locally

Requirements: Node.js 22 LTS (or Node 20.19+). Check installation with `node --version` and `npm --version`.

If zsh says `npm: command not found` after installing nvm, load nvm in the current terminal and install Node:

```sh
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
```

Then from the project directory:

```sh
npm ci
cp .env.example .env
npm run db:migrate
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server proxies API requests to Express on port 3001. The schema migrates automatically when the API starts; `db:migrate` is also available for an explicit migration run.

To load the synthetic demonstration workspace in a non-production environment, open a second terminal and run:

```sh
npm run db:seed:demo
```

Demo sign-in: `demo@abhinexus.local` / `Abhinexus-Demo-2026!`. Change these with `DEMO_EMAIL` and `DEMO_PASSWORD` before seeding if needed. The seed command refuses to run when `NODE_ENV=production`.

Alternatively, create a workspace using the registration screen. Passwords must be at least 12 characters. New accounts start with an empty project portfolio and a 14-day trial record.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and Vite development server |
| `npm test` | Run API, tenant-isolation, workflow, and migration tests |
| `npm run lint` | Run Oxlint |
| `npm run build` | Type-check and create production frontend assets |
| `npm start` | Start the production API and serve `dist/` |
| `npm run db:migrate` | Apply pending SQLite migrations |
| `npm run db:seed:demo` | Add the clearly marked synthetic demo organization |
| `npm run db:seed:demo:reset` | Replace the isolated demo organization and its sample records |
| `npm run db:backup` | Create a consistent, permission-restricted SQLite backup |

Production local run:

```sh
cp .env.example .env
# Set NODE_ENV=production and a production APP_ORIGIN in .env.
npm ci
npm run build
npm start
```

The database defaults to `data/abhinexus.db`; set `DATABASE_PATH` to change it. Keep `.env`, the database, and backups out of source control. The local demo account is not a production account.

## MVP capabilities

- Portfolio and project tracking, dashboard KPIs, project search/filter/sort, and pagination.
- Tasks with priority/status/effort, finish-to-start prerequisites, cycle/date checks, and paginated lists.
- Milestones, resource assignments with overlapping-capacity validation, and risk scoring/mitigation.
- Budget, actual, and forecast tracking in integer cents; finance fields and endpoints are role-gated.
- Organization membership roles, isolated organization data, password login/registration, secure session cookies, audit events, notifications, and CSV exports.
- Synthetic data for a five-project sample portfolio, with explicit sample-data labeling.

See [docs/PRODUCT-SCOPE.md](./docs/PRODUCT-SCOPE.md) for what is implemented, partial, or dependent on external services. This repository is a working MVP, not a claim that every enterprise and commercial requirement in the originating brief is production-ready.

## Docker

With Docker Compose installed:

```sh
docker compose up --build -d
```

Open [http://localhost:3001](http://localhost:3001). The Compose service uses a persistent named volume, a non-root process, dropped Linux capabilities, a read-only root filesystem, and a readiness health check. Set `APP_ORIGIN` to the browser-visible origin when deploying behind a domain or reverse proxy. See [docs/OPERATIONS.md](./docs/OPERATIONS.md) before exposing it beyond a trusted development environment.

## Documentation

- [Product scope and launch gates](./docs/PRODUCT-SCOPE.md)
- [Product requirements](./docs/PRD.md)
- [Architecture and data model](./docs/ARCHITECTURE.md)
- [Database schema](./docs/DATABASE_SCHEMA.md)
- [API reference](./docs/API_REFERENCE.md)
- [Security model](./docs/SECURITY.md)
- [Test plan](./docs/TEST_PLAN.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Operations runbook](./docs/OPERATIONS_RUNBOOK.md)
- [User guide](./docs/USER_GUIDE.md)
- [Pricing hypotheses](./docs/PRICING.md)
- [Release checklist](./docs/RELEASE_CHECKLIST.md)
- [Synthetic portfolio review](./docs/DEMO-PORTFOLIO-REVIEW.md)
- [Portfolio case study](./docs/PORTFOLIO_CASE_STUDY.md)
- [Prioritization model](./docs/PRIORITIZATION_MODEL.md)
- [Resource optimization](./docs/RESOURCE_OPTIMIZATION_CASE.md)
- [Financial analysis](./docs/FINANCIAL_ANALYSIS.md)
- [Architecture diagram](./docs/ARCHITECTURE_DIAGRAM.md)
- [Demo guide](./docs/DEMO_GUIDE.md)
- [Commercial launch plan](./docs/COMMERCIAL_LAUNCH_PLAN.md)

# Product requirements document

**Product:** AbhiNexus  
**Document status:** MVP baseline; enterprise scope remains future work  
**Evidence note:** Product requirements are derived from the supplied brief. Market demand, willingness to pay, customer outcomes, and product performance have not been validated.

## Problem and opportunity

Organizations often manage project budgets, dates, people, risks, and executive updates in disconnected spreadsheets. AbhiNexus aims to provide one organization-scoped workspace for portfolio visibility and core delivery decisions.

## Goals

1. Give portfolio leaders a current view of delivery health, budget, risk, and capacity.
2. Let project teams record projects, tasks, dependencies, milestones, resources, costs, and risks.
3. Keep organization data isolated and financial access role-gated.
4. Provide a credible synthetic demonstration without presenting seed metrics as customer results.

## Personas and jobs

| Persona | Job to be done |
| --- | --- |
| Executive / sponsor | Identify material delivery and financial exceptions and decide what needs escalation. |
| Portfolio manager / PMO | Prioritize projects, understand aggregate health, and coordinate capacity. |
| Project manager | Maintain schedule, milestones, tasks, risks, budget, and forecast. |
| Team lead / contributor | Understand assigned work, effort, prerequisites, and due dates. |
| Finance viewer | Review recorded project budget, actuals, and forecasts without permission to edit them. |
| Workspace owner / admin | Manage organization settings and inspect audit activity. |

## MVP functional requirements and acceptance

- **Workspace and access:** registration creates an owner and isolated organization. Login, logout, organization switching, and protected routes work. Cross-organization reads and writes return no data or a not-found response.
- **Portfolio and projects:** users with appropriate roles can create/update portfolio and project records. Project lists support search, filters, sorting, and bounded pagination.
- **Tasks and dependencies:** authorized users can maintain task status, priority, assignee, effort, and dates. Finish-to-start links are same-project only; the API rejects cycles, date conflicts, and completion before prerequisites.
- **Resources:** authorized users can record weekly capacity and date-bounded assignments. Overlapping assignments above 100% are rejected.
- **Finance:** finance readers can view permitted values; finance writers can add actual and forecast entries. Stored amounts are integer cents. Budget variance is budget minus actual; forecast variance is budget minus forecast.
- **Risk:** users can record probability, impact, mitigation, contingency, owner, residual assessment, status, and escalation. Scores are probability × impact.
- **Reporting:** portfolio dashboard, action items, print view, and authenticated CSV reports use current organization data. CSV mitigates spreadsheet formula injection.
- **Audit and notifications:** important operations are auditable. Escalated/high-scoring risk creation can notify privileged organization members in-app.

## Non-functional requirements

- Validate API inputs and enforce tenant scope and role permissions on the server.
- Persist application state across restarts using SQLite and apply numbered migrations.
- Use salted password hashes and opaque, HttpOnly session cookies.
- Preserve existing legacy project/resource/risk/milestone tables during initial migration.
- Make data/demo provenance visible and prohibit demo seeding in production mode.

## Success indicators for a pilot

These are recommended measurements, not achieved outcomes:

- Zero confirmed cross-organization data exposures in automated tests and pilot review.
- 100% pass rate for the release's required automated tests.
- Track successful completion rate and time-to-complete for creating a project, assigning work, recording a cost, and preparing a portfolio review.
- Track weekly active pilot organizations, repeat portfolio-review usage, and percentage of active projects with an owner, schedule, status, and current forecast.
- Collect structured feedback from executive, PMO, and project-team roles before finalizing thresholds or pricing.

## Release scope and exclusions

The current release is the focused MVP described in [PRODUCT-SCOPE.md](./PRODUCT-SCOPE.md). Password recovery, invitations, email verification, production billing, SSO/SCIM, integrations, attachments, comments, Gantt/critical-path planning, advanced calendars, approval workflows, and scale-out infrastructure are excluded until designed, implemented, and verified.

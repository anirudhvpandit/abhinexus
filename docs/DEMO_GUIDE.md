# 10-minute product demo guide

**Audience:** recruiter, prospective customer, or MBA interviewer.  
**Data:** use only the visibly labeled synthetic demo organization. Do not present seed metrics as customer outcomes.

| Time | Demo step | Story |
| --- | --- | --- |
| 0:00–1:00 | Sign in and Overview | Explain the problem: leaders need one current view of delivery, budget, capacity, and risk. Point out synthetic-data labeling. |
| 1:00–2:00 | Portfolio page | Show strategic objectives and the projects linked to each portfolio. |
| 2:00–3:30 | Projects | Filter/search and compare health, progress, budget, and forecast. Explain role-dependent finance visibility. |
| 3:30–5:00 | Tasks & Work | Open the cutover tasks; show the finish-to-start link and blocked-by-prerequisite indicator. Mention cycle/date validation. |
| 5:00–6:00 | Roadmap and Resources | Review milestones and current allocation; explain that availability is simple percentage capacity, not leave-aware planning. |
| 6:00–7:15 | Financials | Compare approved budget, actuals, and forecast. Use ERP's $190k forecast headroom and the portfolio's $130k forecast overrun, while noting no transfers are implied. |
| 7:15–8:15 | Risks & Issues | Show probability × impact, owner, mitigation, residual score, and escalation. |
| 8:15–9:15 | Reports | Open the printable portfolio review and show authenticated CSV exports. Discuss key decisions and their synthetic owners. |
| 9:15–10:00 | Close | Explain current MVP scope and ask what workflow, integrations, governance, and evidence the audience requires next. |

## Reset and setup

```sh
npm run db:seed:demo
# To intentionally replace the isolated seeded demo workspace:
npm run db:seed:demo:reset
```

Reset is destructive to that one demo organization and its records. Use it only on a local/demo database. It refuses to delete an account that is not the sole member of exactly one demo organization.

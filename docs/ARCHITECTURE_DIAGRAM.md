# Technical architecture diagram

## Current MVP runtime

```mermaid
flowchart LR
  Browser[Browser: React + TypeScript] -->|same-origin JSON and cookie| API[Express API]
  API --> Auth[Authentication, tenant scope, role checks]
  Auth --> SQLite[(SQLite database)]
  API --> Static[Built Vite assets]
  Dev[Vite dev server] -. development proxy .-> API
  Seed[Local synthetic seed script] --> SQLite
  Backup[Online backup utility] --> SQLite
  SQLite --> BackupFile[(Restricted backup file)]
```

## Planned integrations (not connected)

```mermaid
flowchart LR
  API[Express API] -. future provider decision .-> Email[Email and identity provider]
  API -. future provider decision .-> Billing[Payment and subscription provider]
  API -. future design .-> Worker[Background job queue]
  API -. future design .-> ObjectStore[Object storage for attachments]
  SQLite[Single-instance SQLite] -. future scale review .-> ManagedDB[Managed production database]
```

Dashed connections are roadmap concepts, not available integrations. There is no configured background worker, email delivery, payment processing, attachment store, or horizontally scaled deployment.

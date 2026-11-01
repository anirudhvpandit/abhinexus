# Security model and launch review

## Implemented controls

- Salted Node scrypt password hashes; raw passwords are not stored.
- Random opaque session token in an HttpOnly, SameSite=Strict cookie; only the token digest is stored. The Secure attribute is enabled for `NODE_ENV=production`.
- Session expiry, explicit logout revocation, authentication rate limiting, Helmet headers, JSON body size limit, Zod request validation, and request IDs.
- Origin checks on unsafe requests when an `Origin` header is present; CORS is restricted to configured/local development origins.
- Organization ID is derived from the authenticated session. SQL queries and composite foreign keys scope records to the current tenant.
- Fixed role authorization and finance-field/API restrictions; unit/integration tests cover selected role and tenant cases.
- CSV formula prefixes are neutralized before export.
- Demo seeding is disabled in production mode; local seeded records are labeled synthetic.

## Limitations and residual risks

- No independent security assessment, penetration test, compliance review, or certification has been performed.
- Email verification, password reset, invitations, MFA, SSO, SCIM, account lockout workflow, and security alerts are not implemented.
- No CSRF token mechanism is present. SameSite cookies and origin checks are defense-in-depth; review browser/proxy behavior and request-origin policy before internet exposure.
- Auth rate limiting uses the default in-process store; it is not coordinated across multiple app instances.
- No external secrets manager, database encryption-at-rest integration, encrypted backup automation, centralized monitoring, or incident-response integration is configured.
- The single-instance SQLite deployment is not designed for horizontal scaling.
- Session cleanup/retention is not a scheduled job; expired sessions are rejected but may remain stored.
- A production reverse proxy must set correct external origin/TLS behavior; `APP_ORIGIN` must match the browser-visible origin.

## Production launch checklist

- [ ] Configure TLS, public `APP_ORIGIN`, production host/network controls, and secure cookies.
- [ ] Remove demo users/data and test credentials; verify `NODE_ENV=production`.
- [ ] Use a managed secrets mechanism and rotate any credentials that may have been used outside local development.
- [ ] Review roles and permissions with a representative customer; test negative access for every sensitive route.
- [ ] Perform threat modeling and independent application, dependency, and infrastructure security reviews.
- [ ] Define data classification, retention/deletion, privacy notice, incident response, and support access procedures.
- [ ] Configure off-host encrypted backups, retention, alerting, integrity checks, and successful restore drills.
- [ ] Add monitoring for auth abuse, application failures, database/storage capacity, and backup freshness.
- [ ] Decide on a supported production database and multi-instance strategy before scaling beyond one instance.

## Reporting an issue

Do not include real credentials, customer records, or production database content in issue reports. Include a sanitized request ID, environment type, impact, and reproducible steps.

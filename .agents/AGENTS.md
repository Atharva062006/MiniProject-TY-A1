# APNILEAP Project Rules

## Core Directives
1. **No External Databases**: This project implements a custom DBMS engine from scratch in JSON. Do NOT install MongoDB, PostgreSQL, SQLite, Prisma, Sequelize, etc. Data persistence is strictly handled by `services/team-c-placement` manipulating JSON files.
2. **From-Scratch Data Structures**: All algorithms must use from-scratch implementations. E.g., B-Trees, Hash Maps, Tries, Decision Trees, Graph algorithms. Do not import `lodash` or external NPM algorithm packages.
3. **Strict Team Boundaries**:
   - **Team A (Eligibility)**: Decision Trees, Queues. Read-only direct DB. Must use HTTP APIs for mutations.
   - **Team B (Ranking)**: Graph matching, MST, Tries. Must use HTTP APIs.
   - **Team C (Placement/DB)**: Authoritative DB engine. ACID transactions, Lock Manager, WAL. Owns all API endpoints on port 3003.
   - **Team D (Portal)**: UI and API Gateway. Consumes Team C's REST APIs and SSE stream.
4. **Shared Module**: Always use the `shared/` package for the `X-Correlation-ID` middleware, standardized error handling, and `sendSuccess` response formats.
5. **Idempotency**: All cross-service mutating POST/PUT requests must implement and pass an `Idempotency-Key` header. Team C enforces this via `idempotencyService.js` and the `checkIdempotency` middleware.
6. **Living Documentation**: Agents MUST update `AI_DEVELOPMENT_GUIDE.md` and `.agents/AGENTS.md` whenever significant architectural changes, new services, or structural modifications are made to accurately reflect the current state of the project.

## Team C — Implemented API Surface (Port 3003)

All routes are mounted under `/api/v1`. Internal routes (service-to-service) are under `/api/v1/internal`.

### Master Data (C1)
- `POST   /api/v1/companies` — Create a company
- `GET    /api/v1/companies` — List all companies
- `GET    /api/v1/companies/:companyId` — Get company by ID
- `POST   /api/v1/students` — Create a student
- `POST   /api/v1/drives` — Create a drive (requires `company_id`)
- `GET    /api/v1/drives` — List drives (optional `?state=OPEN`)
- `GET    /api/v1/drives/:driveId` — Get drive by ID
- `GET    /api/v1/drives/:driveId/criteria` — Get drive eligibility criteria
- `PATCH  /api/v1/internal/drives/:driveId` — Update drive state/fields

### Applications (C2)
- `POST   /api/v1/applications` — Create application (idempotent via `idempotency_key`)
- `GET    /api/v1/applications` — List applications (filter: `?student_id`, `?drive_id`, `?state`)
- `GET    /api/v1/applications/:applicationId` — Get application by ID
- `POST   /api/v1/applications/:applicationId/withdraw` — Withdraw an application

### Offers & Compensation (C3)
- `POST   /api/v1/internal/offers/commit` — Atomically commit a state transition (with seat claim on SELECTED, offer commit on OFFER_ISSUED)
- `POST   /api/v1/internal/offers/compensate` — Roll back a failed workflow step

### Audit, Reports & Recovery (C4)
- `GET    /api/v1/audit` — Query append-only audit log (filter by correlation_id, record_id, date range)
- `GET    /api/v1/reports/placement-performance` — Placement report with branch breakdown, package distribution, conversion rates
- `POST   /api/v1/internal/recovery/verify` — Trigger WAL recovery verification

### SSE Event Stream (C4 Outbox)
- `GET    /api/v1/stream` — Server-Sent Events stream. Emits `audit` events on every data mutation. Team D connects here for live dashboard updates.

## Application State Machine
Full state flow (defined in `shared/constants.js`):
```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED
```
Alternative outcomes: `NOT_ELIGIBLE`, `WAITLISTED`, `WITHDRAWN`, `EXPIRED`, `COMPENSATION_REQUIRED`

Only Team C's `stateMachineService.js` enforces valid transitions. All other teams receive the current state via API — they must never modify it directly.

## Workflow
- `npm run start:all` — Spin up all 4 microservices (ports 3000–3003).
- `npm run start:c` — Start only Team C on port 3003.
- `npm run seed` — Pre-populate DB with deterministic test data.
- `npm run health` — Ping all 4 services.
- Refer to `AI_DEVELOPMENT_GUIDE.md` and `RIT_Placement_Eligibility_System_Design_APIs_Sequences_KPIs by GSW.md` for full architectural constraints.

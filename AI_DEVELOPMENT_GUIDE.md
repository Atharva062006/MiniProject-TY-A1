# APNILEAP — Agent & Developer Guidelines

> **CRITICAL WARNING TO ALL AI AGENTS**: Read this document entirely before making any code changes. This project has strict academic constraints, specific team boundaries, and a custom architecture. **Do NOT use external databases (MongoDB, PostgreSQL, SQLite, etc.) or standard ORMs. Everything must be built from scratch in Vanilla Javascript using custom data structures.**

## 1. Project Architecture & Monorepo Structure

This is a Node.js/Express Monorepo consisting of 4 independent microservices that communicate via HTTP REST APIs.

*   **`shared/`**: Centralized logic. Contains standard HTTP response wrappers (`sendSuccess`), Error classes (`NotFoundError`, `ConflictError`, `ValidationError`, `InvalidTransitionError`), `X-Correlation-ID` middleware, `APPLICATION_STATES` + `VALID_TRANSITIONS` constants, and `DRIVE_STATES`. **All teams MUST use these shared utilities.**
*   **`services/team-a-eligibility/`**: (Port 3001) Responsible for evaluating student eligibility using **Decision Trees** and processing requests via **Priority Queues**.
*   **`services/team-b-ranking/`**: (Port 3002) Responsible for matching and ranking students using **Graph Algorithms (Bipartite matching, MST)** and **Tries**.
*   **`services/team-c-placement/`**: (Port 3003) The Authoritative DBMS Engine. Controls all persistent state.
*   **`services/team-d-portal/`**: (Port 3000) The Frontend Portal / Backend-for-Frontend.

## 2. Team C's Custom DBMS Engine (IMPORTANT)

Team C acts as the "Database".
*   **No other team is allowed to write to data files.** Teams A, B, and D **MUST** make HTTP requests to `http://localhost:3003` to fetch or update data.
*   Data is persisted in `services/team-c-placement/data/tables/*.json`.
*   Team C implements ACID transactions, a Write-Ahead Log (WAL), Deadlock detection (Wait-For Graph), and secondary indexes (B-Tree and Hash Map). **Do not modify Team C's engine unless you are explicitly assigned to Team C.**

### Team C File Structure
```
services/team-c-placement/
├── server.js                        # Express entry point, DI wiring
├── data/
│   ├── tables/                      # Persisted JSON tables
│   │   ├── students.json
│   │   ├── companies.json
│   │   ├── drives.json
│   │   ├── applications.json
│   │   ├── eligibility_decisions.json
│   │   ├── offers.json
│   │   ├── audit_log.json
│   │   └── idempotency_keys.json
│   └── wal/                         # Write-Ahead Log archives
└── src/
    ├── db/
    │   ├── Database.js              # Main facade (TableAPI + index wiring)
    │   ├── engine/
    │   │   ├── StorageEngine.js     # JSON file I/O + in-memory cache
    │   │   ├── WAL.js               # Write-Ahead Log (crash recovery)
    │   │   ├── LockManager.js       # Row-level locking + deadlock detection
    │   │   └── TransactionManager.js # ACID transaction orchestration
    │   ├── indexes/
    │   │   ├── BTreeIndex.js        # B-Tree for range queries
    │   │   └── HashIndex.js         # Hash map for equality lookups
    │   └── schema/
    │       ├── SchemaManager.js     # 3NF schema, constraints, FK validation
    │       └── migrations.js        # Schema versioning & migration runner
    ├── services/
    │   ├── applicationService.js    # C2: create, get, withdraw, list, transitionState
    │   ├── auditService.js          # C4: append-only audit log + SSE broadcast
    │   ├── idempotencyService.js    # Idempotency key store and lookup
    │   ├── offerService.js          # C3: commitOffer (SELECTED/OFFER_ISSUED), compensate
    │   ├── recoveryService.js       # C4: WAL recovery verification
    │   ├── reportService.js         # C4: placement report (branch/drive breakdown, packages)
    │   ├── sseService.js            # C4: SSE broadcast hub (singleton)
    │   └── stateMachineService.js   # State transition enforcement
    ├── controllers/
    │   ├── applicationController.js # create, list, get, withdraw
    │   ├── auditController.js       # query
    │   ├── companyController.js     # create, list, get
    │   ├── driveController.js       # create, list, get, getCriteria, update
    │   ├── offerController.js       # commit, compensate
    │   ├── reportController.js      # getPlacementPerformance, verifyRecovery
    │   └── studentController.js     # create
    ├── routes/
    │   └── index.js                 # All routes wired here
    └── middleware/
        ├── auth.js                  # Auth + role guard (stub — wire real JWT for prod)
        ├── idempotency.js           # checkIdempotency middleware
        └── validation.js            # validateBody helper
```

### Team C API Surface (all at `http://localhost:3003`)
| Method | Endpoint | Notes |
|--------|----------|-------|
| `GET`   | `/health` | Health check |
| `POST`  | `/api/v1/companies` | Create company |
| `GET`   | `/api/v1/companies` | List companies |
| `GET`   | `/api/v1/companies/:id` | Get company |
| `POST`  | `/api/v1/students` | Create student |
| `POST`  | `/api/v1/drives` | Create drive |
| `GET`   | `/api/v1/drives` | List drives (`?state=OPEN`) |
| `GET`   | `/api/v1/drives/:id` | Get drive |
| `GET`   | `/api/v1/drives/:id/criteria` | Get eligibility criteria |
| `PATCH` | `/api/v1/internal/drives/:id` | Update drive |
| `POST`  | `/api/v1/applications` | Create application (idempotent) |
| `GET`   | `/api/v1/applications` | List (`?student_id`, `?drive_id`, `?state`) |
| `GET`   | `/api/v1/applications/:id` | Get application |
| `POST`  | `/api/v1/applications/:id/withdraw` | Withdraw |
| `POST`  | `/api/v1/internal/offers/commit` | Commit state transition |
| `POST`  | `/api/v1/internal/offers/compensate` | Compensate failed step |
| `GET`   | `/api/v1/audit` | Query audit log |
| `GET`   | `/api/v1/reports/placement-performance` | Placement analytics |
| `POST`  | `/api/v1/internal/recovery/verify` | WAL recovery check |
| `GET`   | `/api/v1/stream` | SSE live event stream (Team D connects here) |

## 3. Application State Machine

Defined in `shared/constants.js` (`APPLICATION_STATES`, `VALID_TRANSITIONS`). Enforced by `stateMachineService.js`.

```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED
```
Alternative outcomes (terminal or re-entrant): `NOT_ELIGIBLE`, `WAITLISTED`, `WITHDRAWN`, `EXPIRED`, `COMPENSATION_REQUIRED`

**Only Team C changes authoritative application state** via `POST /internal/offers/commit`.

## 4. Strict Rules for AI Agents

1.  **Respect Team Boundaries**: If you are assigned to help Team A, you are NOT allowed to modify Team B or Team C code. If Team A needs data, write a `fetch()` or `axios` call to Team C's API. Do not import Team C's `Database.js` into Team A.
2.  **No External Databases**: Do not install `mongoose`, `sqlite3`, `pg`, `sequelize`, or `redis`. Data persistence is handled purely by Team C's JSON engine.
3.  **Use Data Structures from Scratch**: If a feature requires sorting, searching, or queuing, implement the pure Computer Science data structure from scratch (e.g., `PriorityQueue`, `AdjacencyList`, `BTreeIndex`). Do not rely on external NPM packages for core logic.
4.  **Use Shared Correlation IDs**: Every HTTP request across services MUST pass the `X-Correlation-ID` header. Use the `sendSuccess` and `errorHandler` functions from the `shared/` folder to ensure responses are standardized.
5.  **State Machine Compliance**: An application goes through strict states — see Section 3 above. Do not arbitrarily change strings. Rely on `shared/constants.js` and Team C's `stateMachineService.js`.
6.  **Living Documentation**: You MUST update this `AI_DEVELOPMENT_GUIDE.md` and `.agents/AGENTS.md` whenever significant architectural changes, new services, or structural modifications are made to accurately reflect the current state of the project.

## 5. Development Commands

*   `npm run start:all` - Boots all 4 microservices simultaneously.
*   `npm run start:a`  - Start only Team A (port 3001).
*   `npm run start:b`  - Start only Team B (port 3002).
*   `npm run start:c`  - Start only Team C (port 3003).
*   `npm run start:d`  - Start only Team D (port 3000).
*   `npm run seed`     - Pre-populates the database with deterministic test data.
*   `npm run health`   - Pings all 4 services to ensure they are alive.
*   `npm run test:c`   - Runs Team C's test suite.

## 6. Idempotency & Concurrency

Team C has implemented an `Idempotency-Key` requirement for state-mutating requests (like creating an application). If you are building a service in Team A or Team D that sends POST requests to Team C, ensure you generate and pass an `Idempotency-Key` header to prevent duplicate side effects. Retrying with the same key returns the original response without creating a duplicate record.

## 7. SSE Event Stream

Team C exposes a Server-Sent Events stream at `GET /api/v1/stream`. After every data mutation, `auditService.js` broadcasts an `audit` event to all connected clients. Team D should connect to this endpoint for live dashboard updates. A `:heartbeat` comment is sent every 15 seconds to keep connections alive through proxies.

---
*By strictly following these boundaries, Teams A, B, C, and D can develop their complex data structure algorithms independently without corrupting the global state.*

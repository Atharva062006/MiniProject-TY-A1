# APNILEAP — Agent & Developer Guidelines

> **CRITICAL WARNING TO ALL AI AGENTS**: Read this document entirely before making any code changes. This project has strict academic constraints, specific team boundaries, and a custom architecture. **Do NOT use external databases (MongoDB, PostgreSQL, SQLite, etc.) or standard ORMs. Everything must be built from scratch in Vanilla Javascript using custom data structures.**

## 1. Project Architecture & Monorepo Structure

This is a Node.js/Express Monorepo consisting of 4 independent microservices that communicate via HTTP REST APIs.

*   **`shared/`**: Centralized logic. Contains standard HTTP response wrappers, Error classes, `X-Correlation-ID` middleware, and the `APPLICATION_STATES` constants. **All teams MUST use these shared utilities.**
*   **`services/team-a-eligibility/`**: (Port 3001) Responsible for evaluating student eligibility using **Decision Trees** and processing requests via **Priority Queues**.
*   **`services/team-b-ranking/`**: (Port 3002) Responsible for matching and ranking students using **Graph Algorithms (Bipartite matching, MST)** and **Tries**.
*   **`services/team-c-placement/`**: (Port 3003) The Authoritative DBMS Engine. Controls all persistent state.
*   **`services/team-d-portal/`**: (Port 3000) The Frontend Portal / Backend-for-Frontend.

## 2. Team C's Custom DBMS Engine (IMPORTANT)

Team C acts as the "Database". 
*   **No other team is allowed to write to data files.** Teams A, B, and D **MUST** make HTTP requests to `http://localhost:3003` to fetch or update data.
*   Data is persisted in `services/team-c-placement/data/tables/*.json`.
*   Team C implements ACID transactions, a Write-Ahead Log (WAL), Deadlock detection (Wait-For Graph), and secondary indexes (B-Tree and Hash Map). **Do not modify Team C's engine unless you are explicitly assigned to Team C.**

## 3. Strict Rules for AI Agents

1.  **Respect Team Boundaries**: If you are assigned to help Team A, you are NOT allowed to modify Team B or Team C code. If Team A needs data, write a `fetch()` or `axios` call to Team C's API. Do not import Team C's `Database.js` into Team A.
2.  **No External Databases**: Do not install `mongoose`, `sqlite3`, `pg`, `sequelize`, or `redis`. Data persistence is handled purely by Team C's JSON engine.
3.  **Use Data Structures from Scratch**: If a feature requires sorting, searching, or queuing, implement the pure Computer Science data structure from scratch (e.g., `PriorityQueue`, `AdjacencyList`, `BTreeIndex`). Do not rely on external NPM packages for core logic.
4.  **Use Shared Correlation IDs**: Every HTTP request across services MUST pass the `X-Correlation-ID` header. Use the `sendSuccess` and `errorHandler` functions from the `shared/` folder to ensure responses are standardized.
5.  **State Machine Compliance**: An application goes through strict states (`APPLIED` -> `RULE_EVALUATED` -> `SHORTLISTED` -> `SELECTED`). Do not arbitrarily change strings. Rely on `shared/constants.js` and Team C's `stateMachineService.js`.
6.  **Living Documentation**: You MUST update this `AI_DEVELOPMENT_GUIDE.md` and `.agents/AGENTS.md` whenever significant architectural changes, new services, or structural modifications are made to accurately reflect the current state of the project.

## 4. Development Commands

*   `npm run start:all` - Boots all 4 microservices simultaneously.
*   `npm run seed` - Pre-populates the database with deterministic test data.
*   `npm run health` - Pings all 4 services to ensure they are alive.

## 5. Idempotency & Concurrency

Team C has implemented an `Idempotency-Key` requirement for state-mutating requests (like creating an application). If you are building a service in Team A or Team D that sends POST requests to Team C, ensure you generate and pass an `Idempotency-Key` header to prevent duplicate side effects.

---
*By strictly following these boundaries, Teams A, B, C, and D can develop their complex data structure algorithms independently without corrupting the global state.*

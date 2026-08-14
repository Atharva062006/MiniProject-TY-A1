# APNILEAP Project Rules

## Core Directives
1. **No External Databases**: This project implements a custom DBMS engine from scratch in JSON. Do NOT install MongoDB, PostgreSQL, SQLite, Prisma, Sequelize, etc. Data persistence is strictly handled by `services/team-c-placement` manipulating JSON files.
2. **From-Scratch Data Structures**: All algorithms must use from-scratch implementations. E.g., B-Trees, Hash Maps, Tries, Decision Trees, Graph algorithms. Do not import `lodash` or external NPM algorithm packages.
3. **Strict Team Boundaries**:
   - **Team A (Eligibility)**: Decision Trees, Queues. Read-only direct DB. Must use HTTP APIs for mutations.
   - **Team B (Ranking)**: Graph matching, MST, Tries. Must use HTTP APIs.
   - **Team C (Placement/DB)**: Authoritative DB engine. ACID transactions, Lock Manager, WAL.
   - **Team D (Portal)**: UI and API Gateway.
4. **Shared Module**: Always use the `shared/` package for the `X-Correlation-ID` middleware, standardized error handling, and `sendSuccess` response formats.
5. **Idempotency**: All cross-service mutating POST/PUT requests must implement and pass an `Idempotency-Key` header.
6. **Living Documentation**: Agents MUST update `AI_DEVELOPMENT_GUIDE.md` and `.agents/AGENTS.md` whenever significant architectural changes, new services, or structural modifications are made to accurately reflect the current state of the project.

## Workflow
- Run `npm run start:all` to spin up all 4 microservices on ports 3000-3003.
- Refer to `AI_DEVELOPMENT_GUIDE.md` and `RIT_Placement_Eligibility_System_Design_APIs_Sequences_KPIs by GSW.md` for architectural constraints.

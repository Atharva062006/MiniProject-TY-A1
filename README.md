# APNILEAP — Rule-Based Placement Eligibility & Performance Analytics

Academic Year 2026–27 | RIT CSE Mini Project

## Teams

| Team | Domain | Responsibility |
|------|--------|---------------|
| **A** | OS Engine | Eligibility rule-chain & interview scheduling |
| **B** | DS Engine | Ranking & shortlisting analytics |
| **C** | DBMS Engine | Authoritative data & transaction manager ★ |
| **D** | Web Technology | Placement portal & analytics dashboard |

## Architecture

All teams communicate via versioned HTTPS/JSON APIs (`/api/v1/...`). Every cross-team call carries an `X-Correlation-ID`. Team C is the single source of truth for application state.

## Getting Started

```bash
# Install all dependencies
npm install

# Start Team C (DBMS engine) standalone
npm run start:c

# Run Team C tests
npm run test:c

# Seed sample data
npm run seed
```

## Project Structure

```
services/
  team-a-eligibility/   # Team A — OS Engine (port configurable)
  team-b-ranking/       # Team B — DS Engine
  team-c-placement/     # Team C — DBMS Engine ★
  team-d-portal/        # Team D — Web Frontend + BFF
shared/                 # Common constants, middleware helpers
docs/api-contracts/     # OpenAPI specifications
scripts/                # Dev utilities
tests/e2e/              # End-to-end integration tests
```

## State Machine

```
APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED
                                     ↘ NOT_ELIGIBLE
                                     ↘ WAITLISTED
Any → WITHDRAWN | EXPIRED | COMPENSATION_REQUIRED
```

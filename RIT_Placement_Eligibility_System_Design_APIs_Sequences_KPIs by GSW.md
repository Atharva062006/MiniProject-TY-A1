## APNILEAP INITIATIVE

## Rule-Based Placement Eligibility and Performance Analytics

System Design, Team Feature Contracts, APIs, Sequence Flows and KPIs

Prepared from Theme — RIT CSE Mini Project Implementation

Academic Year 2026–27 | Implementation Blueprint | Version 1.0

## Purpose

Enable four student teams to build independently with explicit boundaries, integrate through versioned contracts, and demonstrate measurable end-to-end engineering outcomes for a rule-driven campus placement eligibility and analytics platform.

Source basis: RIT CSE Theme mini-project format (four-team academic ownership — OS, Data Structures, DBMS, Web Technology)

## 1. Executive Design Summary

## Recommended system boundary

Team D is the user-facing experience and backend-for-frontend; Team C is the authoritative workflow and data owner; Team A and Team B are independent computational services. Cross-team communication uses versioned HTTPS/JSON APIs and a shared correlation ID.

## 1.1 Design objectives

- Preserve the four-team academic ownership model while making interfaces independently testable.

- Separate transactional authority (Team C) from algorithm engines (Teams A and B) and presentation/orchestration (Team D).

- Make every application traceable across all services using application_id, request_id, ranking_id and correlation_id.

- Assess artefacts and engineering evidence — not only whether the final screen appears to work.

- Allow rule-chaining and ranking algorithm variants to be swapped without breaking consumers.

## 1.2 Key architectural decisions

| Decision | Design rule |
| --- | --- |
| Database ownership | Team C alone writes the authoritative relational database. Teams A, B and D use APIs; direct cross-team SQL is avoided to reduce coupling. |
| Orchestration | Team C owns the application state machine; Team D orchestrates the user experience but does not become the system of record. |
| Algorithm isolation | Teams A and B expose deterministic request/response contracts with algorithm_version (or rule_set_version) and test evidence. |
| Live updates | Team D consumes a Server-Sent Events or WebSocket stream for state changes; ordinary commands remain REST calls. |
| Failure handling | Every cross-team command is idempotent; Team C records compensation when a slot lease, database commit, ranking or notification step fails. |

## 2. System Architecture


## Logical Archi — Rul d Eligibility and Analytics

*Synchronous commandiquery path:*

*\+ Asynchronous freshness*

*from Team C outbox*

*path:*

*under*

Synchronous path: HTTPS/JSON for commands and queries; API contracts are versioned under /api/v1.

Asynchronous path: SSE/WebSocket for dashboard freshness; Team C uses an outbox/audit record so committed state changes are not lost.

Security baseline: Authenticated institutional session, role-based authorization, TLS, input/schema validation, rate limits, audit logging and no database credentials in the browser.

## 3. Cross-Team Interface Standards

## 3.1 Common request contract

| Field / header | Required behavior |
| --- | --- |
| Authorization | Bearer token or trusted service credential; every endpoint authorizes the action. |
| X-Correlation-ID | One ID generated at Team D or Team C and propagated through every service and log. |
| Idempotency-Key | Required for application, scheduling and other create/commit operations. |
| X-API-Version | Optional header; URI /api/v1 remains the primary version boundary. |
| Content-Type | application/json; UTF-8. |
| Timestamps | ISO 8601 UTC; UI may localize for display. |
| Identifiers | Opaque stable strings/UUIDs; never reuse a database row number as a public contract. |

## 3.2 Standard response envelopes

```
Success: {"data": {...}, "meta": {"correlation_id": "...", "api_version": "v1"}}
Error: {"error": {"code": "RULE_CONFLICT", "message": "...", "details": [...]},
"meta": {"correlation_id": "..."}}
```

## 3.3 Cross-block data objects


| Object | Minimum fields | Owner |
| --- | --- | --- |
| ApplicationRequest | application_id, student_id, drive_id, resume_version, consent, idempotency_key | Team C |
| EligibilityRequest | request_id, application_id, rule_set_version, priority, submitted_at | Team A |
| EligibilityDecision | decision_id, request_id, eligibility_result, failed_rules, lease_id, metrics | Team A |
| RankingRequest | ranking_id_request, drive_id, graph_version, algorithm, constraints | Team B |
| RankingResult | ranking_id, ordered_candidates, total_score, algorithm, graph_version | Team B |
| Drive | drive_id, company, criteria, seats, package, state, version | Team C |
| DashboardAggregate | application, decision, ranking, freshness, alerts, permissions | Team D |

## 3.4 State machine

## APPLIED → SCREENING → RULE_EVALUATED → SHORTLISTED → INTERVIEW_SCHEDULED → SELECTED → OFFER_ISSUED

Alternative outcomes: NOT_ELIGIBLE, WAITLISTED, WITHDRAWN, EXPIRED or COMPENSATION_REQUIRED.

## Contract rule

Only Team C changes the authoritative application state. Team A returns eligibility/decision state, Team B returns ranking state, and Team D renders the combined view.

## 4.1. Team A — Eligibility Rule & Interview Scheduling Engine

## Operating Systems Engine

## Mission

Accept eligibility-check and interview-scheduling requests, evaluate rule chains against student academic profiles, place shortlisted candidates into interview-slot queues using scheduling policies, allocate limited interview slots safely, and publish rule-execution and scheduling metrics.

## Feature ownership and contracts

## A1. Request intake and rule-queue management

Required inputs: request_id, student_id, drive_id, rule_set_version, submitted_at, priority

Expected outputs: queue_position, state (QUEUED/READY), estimated_evaluation_time, accepted_policy, correlation_id

API(s) exposed: POST /api/v1/eligibility/requests; GET /api/v1/drives/{driveId}/queue

Implementation note: Validate rule-set availability and enqueue atomically. Queue implementation may vary by algorithm: FIFO, circular queue, priority queue, or heap.

## A2. Rule-chain execution and eligibility-decision policy

Required inputs: rule_set (CGPA cutoff, backlog limit, branch allow-list, attendance, skill tags), student academic snapshot, chaining strategy, policy parameters


Expected outputs: decision_id, eligibility_result (ELIGIBLE/CONDITIONAL/NOT_ELIGIBLE), failed_rules, rule_set_version, decision_metrics

API(s) exposed: POST /internal/v1/rules/evaluate; GET /api/v1/eligibility/decisions/{decisionId}

Implementation note: Make the rule-chaining strategy configurable (sequential AND-chain, weighted-priority, decision-tree) so experiments compare evaluation time, throughput and accuracy against a reference rule set.

## Team A feature contracts — continued

## A3. Concurrency, lock and slot-conflict control

Required inputs: slot_id, holder_id, lock_mode, wait-for edges, lease_timeout, allocation intent

Expected outputs: lock_granted, lease_id, conflict_reason, deadlock_cycle, prevention_or_recovery_action

API(s) exposed: POST /internal/v1/locks/acquire; DELETE /internal/v1/locks/{leaseId}; POST /internal/v1/deadlocks/analyse

Implementation note: Use mutex/semaphore simulations and a wait-for graph. No two students may be granted the same exclusive interview slot.

## A4. Runtime state and telemetry

Required inputs: request state changes, simulated rule-evaluation CPU/time usage, batch completion, cancellation or timeout

Expected outputs: evaluation state, queue depth, throughput, wait/turnaround time, starvation/deadlock indicators

API(s) exposed: GET /api/v1/eligibility/requests/{requestId}; GET /api/v1/metrics/eligibility; GET /api/v1/stream/eligibility

Implementation note: Expose read-only state to Team D and eligibility decisions to Team C; use Server-Sent Events or WebSocket only for the live dashboard stream.

## Team A internal building blocks

- Eligibility API controller and request validator

- Queue repository with FIFO, circular, priority-queue and heap variants

- Pluggable rule-chaining strategy (Sequential AND-chain, Weighted-Priority, Decision-Tree)

- Interview-slot lease, semaphore/mutex and wait-for-graph manager

- State-transition publisher and metrics/benchmark collector

## Team A minimum test scenarios

- Equal-priority students evaluated under every rule-chaining strategy

- Rule-set exhaustion, cancellation, lease expiry and duplicate request

- Simultaneous slot-allocation attempts and seeded deadlock cycles

- Large applicant queues used to compare latency, fairness and utilization

## Team A API exposure matrix

| Method | Endpoint | Primary consumer | Contract purpose |
| --- | --- | --- | --- |
| POST | /api/v1/eligibility/requests | Team C | Create an eligibility/scheduling request; idempotent by request_id. |
| GET | /api/v1/drives/{driveId}/queue | Team D | Read ordered queue and estimated evaluation times. |
| GET | /api/v1/eligibility/requests/{requestId} | Teams C/D | Read lifecycle state and decision result. |


| Method | Endpoint | Primary consumer | Contract purpose |
| --- | --- | --- | --- |
| POST | /internal/v1/rules/evaluate | Team C / test harness | Execute a configured rule-chaining strategy. |
| POST | /internal/v1/locks/acquire | Team C | Reserve a simulated interview-slot lease. |
| DELETE | /internal/v1/locks/{leaseId} | Team C | Release reservation after commit/cancel/timeout. |
| GET | /api/v1/metrics/eligibility | Team D | Read algorithm and runtime metrics. |

## Team A sequence diagram

Team A

## Team A measurable KPIs

| KPI | Acceptance target |
| --- | --- |
| Rule-evaluation correctness | 100% match with reference decisions across the agreed rule-set test suite. |
| Decision latency | p95 ≤ 200 ms for 1,000 queued requests on the reference machine. |
| Slot allocation safety | 0 duplicate exclusive-slot allocations in 10,000 concurrent attempts. |
| Deadlock handling | 100% seeded cycles detected; every cycle prevented or resolved within 1 s. |
| Fairness | 0 starvation in bounded tests; publish maximum and p95 wait time by priority class. |
| Telemetry completeness | 100% state transitions carry request_id, timestamp, rule_set_version and correlation_id. |
| API reliability | ≥99.5% successful responses during the integration test window. |

## 4.2. Team B — Ranking & Shortlisting Analytics Engine

## Data Structures Engine


## Mission

Model student skills and drive requirements as a weighted graph, compute deterministic and measurable rankings or shortlists, and provide fast lookup and cohort/performance analytics for placement decision support.

## Feature ownership and contracts

## B1. Skill/requirement graph and profile registry

Required inputs: student_id, skill_tags, cgpa, backlog, project_score; drive_id, required_skills, weightage, min_cutoff

Expected outputs: graph_version, accepted/rejected changes, validation errors, coverage summary

API(s) exposed: PUT /internal/v1/profiles/students/{studentId}; PUT /internal/v1/profiles/drives/{driveId}; GET /api/v1/profiles

Implementation note: Support an adjacency-list implementation of the skill-to-drive graph as the baseline and an adjacency-matrix implementation for comparison experiments.

## B2. Ranking and shortlist computation

Required inputs: drive_id, candidate_pool, graph_version, algorithm (WEIGHTED_SCORE/HEAP_TOPK/MERGE_SORT), optimization_metric, constraints

Expected outputs: ranking_id, ordered_candidates, total_score, tie_break_rule, algorithm, explored_candidate_count

API(s) exposed: POST /api/v1/rankings/compute; GET /api/v1/rankings/{rankingId}

Implementation note: Reject invalid weight vectors. Return graph_version so rankings remain reproducible after profile changes.

## Team B feature contracts — continued

## B3. Fast lookup and shortlist-index optimization

Required inputs: candidate key, shortlist entry, expiry, profile version

Expected outputs: rank, cached_shortlist, lookup_time_us, cache_hit, index statistics

API(s) exposed: GET /internal/v1/shortlist-index/{key}; POST /internal/v1/shortlist-cache/invalidate

Implementation note: Use AVL/Red-Black Tree and hash-map variants so students can compare lookup complexity and memory cost.

## B4. Performance-trend and cohort analysis

Required inputs: historical placement snapshot, department/batch filter, traversal/aggregation algorithm, benchmark size and repetitions

Expected outputs: department_trend, company-wise conversion, package distribution, time/space complexity evidence

API(s) exposed: POST /api/v1/analytics/analyse; GET /api/v1/metrics/ranking

Implementation note: Sorting/aggregation results should be deterministic for a documented tie-break rule.

## Team B internal building blocks

- Profile API and versioned graph repository

- Adjacency-list and adjacency-matrix adapters for skill-requirement mapping

- Pluggable ranking strategy (Weighted-Score, Heap Top-K and Merge Sort)

- AVL/Red-Black Tree and hash-based shortlist-index adapters


- Version-aware ranking cache and complexity/benchmark collector

## Team B minimum test scenarios

- Fully matched, partially matched and disqualified candidate pools

- Invalid weight vector submitted to the ranking engine and no-candidate conditions

- Profile changes during cache use and graph-version mismatch

- Reference cohorts for ranking correctness plus large-pool benchmarks

## Team B API exposure matrix

|   | Method Endpoint | Primary consumer | Contract purpose |
| --- | --- | --- | --- |
| POST | /api/v1/rankings/compute | Teams C/D | Compute the best ranking using an explicit graph version and policy. |
| GET | /api/v1/rankings/{rankingId} | Team D | Read ranking, score and algorithm metadata. |
| GET | /api/v1/profiles | Team D | Render student/drive profiles and graph version. |
| PUT | /internal/v1/profiles/students/{studentId} | Team C/Admin | Create or update a student profile. |
| PUT | /internal/v1/profiles/drives/{driveId} | Team C/Admin | Create or update drive requirements. |
| POST | /api/v1/analytics/analyse |   | Team D / test harness Run cohort/performance analysis. |
| GET | /api/v1/metrics/ranking | Team D | Read ranking latency, cache and complexity metrics. |

## Team B sequence diagram

## Team B — Ranking & Shortlisting Analytics Engine (Sequence Flow)

## Team B measurable KPIs


| KPI | Acceptance target |
| --- | --- |
| Ranking correctness | 100% of reference cohorts return the expected order or documented no-candidate result. |
| Ranking optimality | 0 score deviation from the verified reference implementation for supported algorithms. |
| Computation latency | p95 ≤ 100 ms for a 1,000-student / 5,000-edge reference skill graph. |
| Profile-version consistency | 100% results identify the graph_version used; stale versions are rejected or flagged. |
| Lookup efficiency | p95 shortlist-index lookup ≤ 1 ms; report AVL/RB-tree/hash memory and latency. |
| Cache effectiveness | ≥80% hit rate in the repeated-ranking benchmark; invalidation completed within 2 s. |
| API quality | <1% failed requests at 200 requests/s in the agreed load test. |

## 4.3. Team C — Placement Data & Transaction Manager

## DBMS Engine

## Mission

Own the authoritative data model and transactional workflow for students, companies, drives, applications, eligibility decisions, offers and audit evidence.

## Feature ownership and contracts

## C1. Student, company and drive master data

Required inputs: student profile and academic record; company metadata; drive posting with eligibility criteria, seats, package, schedule

Expected outputs: stable IDs, current state, version, validation result and audit metadata

API(s) exposed: POST /api/v1/students; GET /api/v1/drives; GET /api/v1/drives/{driveId}/criteria; PATCH /internal/v1/drives/{driveId}

Implementation note: Normalize master data to at least 3NF; use constraints and foreign keys as the first integrity boundary.

## C2. Application transaction and conflict control

Required inputs: application_id, student_id, drive_id, resume_version, consent, idempotency key

Expected outputs: application state, version, conflict reason, selected drive, timestamps and audit_id

API(s) exposed: POST /api/v1/applications; GET /api/v1/applications/{applicationId}; POST

/api/v1/applications/{applicationId}/withdraw

Implementation note: Use an ACID transaction and explicit isolation/locking strategy. A retry with the same idempotency key must not create a second application.

## Team C feature contracts — continued

## C3. Eligibility/offer commit and compensation

Required inputs: application_id, Team A decision_id and lease_id, Team B ranking_id, expected application version

Expected outputs: commit_status, committed eligibility/offer, new seat/slot state, conflict details, compensation action

API(s) exposed: POST /internal/v1/offers/commit; POST /internal/v1/offers/compensate


Implementation note: Commit the application and seat/slot state together. On failure, release the Team A lease and record a compensating event.

## C4. Audit, reporting and recovery

Required inputs: actor, action, before/after values, correlation_id, source service, timestamp; backup/recovery

request

Expected outputs: append-only audit record, placement/performance reports, recovery status, RPO/RTO

evidence

API(s) exposed: GET /api/v1/audit; GET /api/v1/reports/placement-performance; POST

/internal/v1/recovery/verify

Implementation note: Use B-tree indexes for range/reporting queries and hash indexes only where equality access and database support justify them.

## Team C internal building blocks

- Application and drive REST controllers with schema validation

- Application state-machine/orchestration service

- Relational repositories, constraints, indexes and migrations

- Transaction, isolation, idempotency and compensation manager

- Append-only audit/outbox, reporting, backup and recovery components

## Team C minimum test scenarios

- Duplicate idempotency key, concurrent application and lost-update attempt

- Database commit failure after Team A grants an interview-slot lease

- Drive-criteria change while an application is in flight

- Backup restore, audit reconciliation and index-performance comparison

## Team C API exposure matrix

|   | Method Endpoint | Primary consumer | Contract purpose |
| --- | --- | --- | --- |
| POST | /api/v1/applications | Team D | Create an idempotent application workflow. |
| GET | /api/v1/applications/{applicationId} | Team D | Read state, decision, ranking and audit references. |
| POST | /api/v1/applications/{applicationId}/withdraw Team D |   | Withdraw and release resources through compensation. |
| GET | /api/v1/drives/{driveId}/criteria | Teams A/D | Read eligibility criteria, seats and capability. |
| POST | /internal/v1/offers/commit | Team A/orchestrator | Atomically commit a leased eligibility decision/offer. |
| PATCH | /internal/v1/drives/{driveId} | Admin/Team D | Change drive operational or criteria state. |
| GET | /api/v1/reports/placement-performance | Team D | Read aggregated placement performance analytics. |
| GET | /api/v1/audit | Team D/Admin | Search immutable audit evidence. |


## Team C sequence diagram

## Team C — Placement Data & Transaction Manager (Sequence Flow)

## Team C measurable KPIs

| KPI | Acceptance target |
| --- | --- |
| Transaction integrity | 100% ACID test cases pass at the documented isolation level. |
| Application safety | 0 duplicate applications or lost updates in 10,000 concurrent application attempts. |
| Commit latency | p95 ≤ 500 ms for application create/confirm excluding intentional queue wait. |
| Data quality | 100% foreign-key, uniqueness and state-transition constraints enforced. |
| Query performance | p95 ≤ 200 ms for agreed drive, application and utilization queries. |
| Audit coverage | 100% create/update/withdraw/offer transitions have actor, time, before/after and correlation_id. |
| Recovery | Demonstrate RPO ≤ 5 minutes and RTO ≤ 30 minutes in the recovery exercise. |

## 4.4. Team D — Placement Portal & Analytics Dashboard

## Web Technology Frontend

## Mission

Provide role-aware application, eligibility-check and analytics experiences while orchestrating Team A, B and C APIs through a stable backend-for-frontend boundary.

## Feature ownership and contracts

## D1. Authentication and role-aware navigation

Required inputs: institution identity/session, role claims, permissions and requested route

Expected outputs: authenticated session, permitted navigation, forbidden/expired-session handling

API(s) exposed: POST /api/v1/ui/session; DELETE /api/v1/ui/session; GET /api/v1/ui/me


Implementation note: Roles: Student, Faculty/TPO, Placement Admin. Team D must never infer authorization only from hidden UI elements; backend APIs enforce it.

## D2. Drive discovery, eligibility check and application experience

Required inputs: branch/CGPA/company filters, selected drive, application form and idempotency key

Expected outputs: eligible drives, validation errors, application_id, state, queue position and estimated evaluation time

API(s) exposed: GET /api/v1/ui/drives; POST /api/v1/ui/applications; GET /api/v1/ui/applications/{applicationId}

Implementation note: The backend-for-frontend calls Team C for authoritative eligibility criteria/application and Team A for live queue detail.

## Team D feature contracts — continued

## D3. Live placement operations dashboard

Required inputs: eligibility-evaluation stream, drive/seat states, ranking/shortlist data, audit events

Expected outputs: queue visualization, seat status, shortlist overlay, alerts and drill-down detail

API(s) exposed: GET /api/v1/ui/dashboard; GET /api/v1/ui/stream; GET /api/v1/ui/rankings

Implementation note: Use asynchronous updates, resilient reconnection and a visible last-updated timestamp. Never silently display stale data.

## D4. Administration, performance-analytics reports and accessibility

Required inputs: drive/criteria edits, report filters, export request, accessibility preferences

Expected outputs: validated administrative action, placement-performance report, export, accessible status and actionable error feedback

API(s) exposed: PATCH /api/v1/ui/drives/{driveId}; GET /api/v1/ui/reports/placement-performance; POST /api/v1/ui/rankings/preview

Implementation note: Use responsive HTML/CSS, modular JavaScript, keyboard operation, sufficient contrast, labels and tested error/retry states.

## Team D internal building blocks

- Responsive browser views and reusable UI components

- Backend-for-frontend aggregation and session boundary

- Role/permission-aware navigation and action guards

- Async API client, SSE/WebSocket reconnection and freshness monitor

- Dashboard visualization, accessibility and error/retry components

## Team D minimum test scenarios

- Student, Faculty/TPO and Placement Admin positive and forbidden flows

- Slow, failed and malformed downstream API responses

- Live-stream disconnect, reconnect and stale-data indication

- Keyboard-only, responsive-layout and cross-browser critical-flow tests

## Team D API exposure matrix

| Method | Endpoint | Primary consumer | Contract purpose |
| --- | --- | --- | --- |
| POST | /api/v1/ui/applications | Browser/mobile UI | Validate and proxy application creation to Team C. |


| Method | Endpoint | Primary consumer | Contract purpose |
| --- | --- | --- | --- |
| GET | /api/v1/ui/applications/{applicationId} | Browser/mobile UI | Aggregate application, queue and ranking status. |
| GET | /api/v1/ui/dashboard | Browser/admin UI | Aggregate drive, eligibility and alert summaries. |
| GET | /api/v1/ui/stream | Browser/admin UI | SSE/WebSocket stream of state changes. |
| GET | /api/v1/ui/rankings | Browser/admin UI | Return Team B rankings and shortlist overlays. |
| PATCH | /api/v1/ui/drives/{driveId} | Placement Admin | Validate and proxy a criteria/status change. |
| GET | /api/v1/ui/reports/placement-performance | Faculty/Admin | Aggregate Team C reports and Team A/B metrics. |

## Team D sequence diagram

## Team D — Placement Portal & Analytics Dashboard (Sequence Flow)

## Team D measurable KPIs

| KPI | Acceptance target |
| --- | --- |
| User task success | ≥95% of test users complete search-and-apply without facilitator help. |
| Initial experience | Largest Contentful Paint ≤ 2.5 s on the agreed campus-network profile. |
| Interaction speed | p95 UI interaction response ≤ 200 ms excluding backend wait. |
| Live freshness | p95 source-event-to-visible-update ≤ 2 s; stale state is clearly marked. |
| Accessibility | 100% critical flows keyboard-operable; no critical automated accessibility violations. |
| Error handling | 100% backend error classes map to a clear message, retry or corrective action. |
| Compatibility | Critical flows pass on the agreed current versions of Chrome, Edge and Firefox. |


## 5. End-to-End Call Flow

## 5.1 Flow interpretation and failure behavior

- 1. Team D authenticates the student, validates the application form and generates or propagates correlation_id and idempotency key.

- 2. Team C validates master data and creates the authoritative application workflow.

- 3. Team C calls Team A with an independently traceable eligibility/scheduling request.

- 4. Team A returns either a leased interview slot with an eligibility decision, a waitlist outcome, or a documented rejection.

- 5. Team C commits application, decision, seat state, audit and outbox event in one database transaction.

- 6. Team C requests a ranking/shortlist position from Team B when the confirmed workflow needs candidate ordering.

- 7. Team C returns a stable aggregate to Team D; Team D renders the outcome and subscribes to subsequent updates.

- 8. If commit fails after Team A grants a lease, Team C releases/compensates the lease. If ranking fails, the application remains valid but ranking_status is DEGRADED and retried.

## 6. End-to-End KPIs and Acceptance Gates

| E2E KPI | Acceptance target | Evidence |
| --- | --- | --- |
| Application completion latency | p95 ≤ 2.0 s from Team D submission to SHORTLISTED/WAITLISTED response, excluding deliberate queue wait. | Distributed trace and load- test report |
| Workflow correctness | 100% expected state transitions; 0 illegal transitions across happy-path and failure-path tests. | State-machine test suite |
| Cross-service consistency | 100% confirmed applications reference a valid eligibility decision; all displayed seat states match Team C. | Reconciliation query/report |


| E2E KPI | Acceptance target | Evidence |
| --- | --- | --- |
| Ranking completion | p95 ranking result available ≤ 500 ms after confirmed eligibility decision; degraded state is explicit on failure. | Trace timestamps and retry log |
| End-to-end reliability | ≥99% successful outcomes at 200 concurrent users; <1% unhandled 5xx responses. | 30-minute integration load test |
| Idempotency | 100% duplicate submissions with the same key return the original outcome and create no duplicate records. | Retry/duplicate test suite |
| Traceability | 100% calls and state changes searchable by correlation_id; IDs link application, eligibility and ranking evidence. | Log and audit inspection |
| Security | 0 unauthorized role actions; 100% sensitive APIs require authentication; no secrets/PII in client logs. | Security test checklist |
| Dashboard freshness | p95 committed-state-to-visible-update ≤ 2 s; stale/disconnected status is clearly shown. | Event timestamp comparison |
| Recovery | A failed downstream step is retried or compensated; no orphan interview-slot lease remains after timeout. | Fault-injection report |

## 6.1 Definition of done

- Every API has an OpenAPI 3.x contract, example payloads, error codes and ownership.

- Each team has unit, contract, performance and negative tests tied to its KPIs.

- The integrated deployment propagates correlation_id and produces one traceable end-to-end application.

- Failure cases — invalid student, no seats, duplicate request, lock conflict, ranking failure and downstream timeout — are demonstrated.

- A KPI evidence pack contains raw results, configuration, environment and interpretation; screenshots alone are insufficient.

## 7. Integration and Delivery Plan

| Phase | Team deliverable | Integration gate |
| --- | --- | --- |
| 1. Contract freeze | OpenAPI schemas, object definitions, error codes, mock examples | All consumers validate against mocks; no ambiguous owner |
| 2. Independent engines | Teams A/B algorithms; Team C schema/workflow; Team D UI/BFF | Unit and component KPIs pass |
| 3. Pairwise integration | A↔C, B↔C, C↔D | Consumer-driven contract tests pass |
| 4. End-to-end workflow | Apply → Evaluate → Rank → Notify → Update | Trace, idempotency and compensation gates pass |
| 5. Performance and resilience | Load, fault injection, recovery and stale-data tests E2E KPI table accepted |   |
| 6. Demonstration and assessment | Working system plus artefacts/evidence | Review panel signs off rubric and improvement backlog |

## 7.1 Team-to-team handoff checklist

- Producer publishes OpenAPI contract, JSON examples, status codes, limits and version policy.

- Consumer writes a mock-based contract test before the producer implementation is complete.


- Producer supplies deterministic seed data and a health/readiness endpoint.

- Both teams agree timeout, retry and idempotency behavior; retries never multiply side effects.

- Breaking changes create /v2 or follow an agreed deprecation window.

- Every interface has one named owner and one consumer representative.

## 7.2 Suggested ownership matrix

| Capability | Accountable | Contributors / consumers |
| --- | --- | --- |
| Eligibility rule algorithms and locks | Team A | Team C integrates; Team D visualizes |
| Ranking and analytics algorithms | Team B | Team C requests; Team D visualizes |
| Data model, application state and audit | Team C | All teams consume |
| User experience and API aggregation | Team D | All teams provide data |
| Common contract and E2E test | One integration lead | One representative from every team |

## 8. Assessment Evidence by Team

| Team | Minimum engineering artefacts | Review emphasis |
| --- | --- | --- |
| A | Rule-chain implementations; queue/lock structures; state diagram; deadlock cases; benchmark report; OpenAPI contract | Correctness, concurrency safety, fairness and measurable comparison |
| B | Skill/requirement graph model; ranking algorithms; tree/hash lookup; complexity analysis; benchmark report; OpenAPI contract | Correctness, optimality, reproducibility and time/space evidence |
| C | ER model; normalized schema; migrations; constraints; transaction/isolation tests; indexes; audit/recovery report; OpenAPI contract | ACID behavior, integrity, query performance and recovery |
| D | Responsive UI; role flows; async state handling; accessibility report; API/BFF contract; user test and browser test evidence | Usability, freshness, resilience, accessibility and error handling |
| E2E | Deployment manifest; seed data; distributed trace; load/fault tests; KPI evidence pack; demo script | Interoperability, idempotency, compensation, traceability and system outcomes |

## 8.1 Source and assumptions

Primary source: RIT CSE mini-project theme brief — Rule-Based Placement Eligibility and Performance Analytics (four-team academic format).

Source concepts retained: Four-team division, artefact-based assessment, rule/scheduling engine, ranking/analytics engine, DBMS engine, dashboard, common JSON contracts and the integrated Apply → Evaluate → Rank → Notify → Update UI workflow.

Design additions: Detailed feature boundaries, API endpoints, common headers, failure handling, ownership rules, sequence flows and measurable acceptance KPIs are strategic elaborations created for implementation.

## Tailoring note

Latency and load thresholds are initial course targets. Faculty may recalibrate them after measuring the available lab hardware, network and cohort scale, but every target should remain numeric and reproducible.

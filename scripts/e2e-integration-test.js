/**
 * End-to-End Integration Test for APNILEAP
 * Tests cross-service flows between Teams A, B, C, and D:
 * 1. Health checks across all 4 services (Ports 3000, 3001, 3002, 3003)
 * 2. Student queries drives through Team D BFF
 * 3. Student applies to open drive via Team D BFF (orchestrating C -> A -> C -> B)
 * 4. Idempotency test (repeat apply returns identical response)
 * 5. Team A Deadlock analysis and rule evaluation strategies
 * 6. Team B Ranking algorithms comparison and AVL Tree index lookup
 * 7. Team D Dashboard aggregation and report retrieval
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const SERVICES = [
  { name: 'Team C - Placement',   dir: 'services/team-c-placement',   port: 3003 },
  { name: 'Team A - Eligibility', dir: 'services/team-a-eligibility', port: 3001 },
  { name: 'Team B - Ranking',     dir: 'services/team-b-ranking',     port: 3002 },
  { name: 'Team D - Portal',      dir: 'services/team-d-portal',      port: 3000 },
];

function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: null, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${options.hostname}:${options.port}${options.path}`));
    });

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('[E2E] Starting all 4 APNILEAP microservices...');
  const processes = [];

  for (const s of SERVICES) {
    const proc = spawn('node', ['server.js'], {
      cwd: path.join(ROOT_DIR, s.dir),
      env: { ...process.env, PORT: String(s.port) },
      stdio: 'pipe',
      shell: true,
    });
    processes.push({ ...s, proc });
  }

  // Cleanup helper
  const cleanup = () => {
    console.log('\n[E2E] Shutting down services...');
    for (const p of processes) {
      try {
        p.proc.kill('SIGTERM');
      } catch (e) {}
    }
  };

  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  PASS: ${message}`);
    } else {
      console.error(`  FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Health checks with retry
    // ----------------------------------------------------
    console.log('\n--- Test 1: Service Health Checks ---');
    for (const s of SERVICES) {
      let healthy = false;
      for (let attempt = 1; attempt <= 15; attempt++) {
        try {
          const res = await httpRequest({
            hostname: 'localhost',
            port: s.port,
            path: '/health',
            method: 'GET',
          });
          if (res.status === 200 && res.data && res.data.status === 'ok') {
            healthy = true;
            break;
          }
        } catch (e) {}
        await delay(500);
      }
      assert(healthy, `${s.name} on port ${s.port} is healthy`);
    }

    // ----------------------------------------------------
    // TEST 2: Team D UI Drives Discovery
    // ----------------------------------------------------
    console.log('\n--- Test 2: Drive Discovery via Team D BFF ---');
    const drivesRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/drives',
      method: 'GET',
      headers: { 'X-Correlation-ID': 'e2e-test-corr-1' },
    });
    assert(drivesRes.status === 200 && Array.isArray(drivesRes.data.data), 'Team D returns available drives');
    const openDrives = drivesRes.data.data;
    assert(openDrives.length >= 1, `Found ${openDrives.length} open drives (DRV001 present)`);
    const sdeDrive = openDrives.find(d => d.drive_id === 'DRV001');
    assert(sdeDrive && sdeDrive.seats > 0, 'DRV001 has available seats');

    // ----------------------------------------------------
    // TEST 3: End-to-End Application Workflow
    // (Apply -> Team C -> Team A Evaluate -> Team C Commit -> Team B Rank)
    // ----------------------------------------------------
    console.log('\n--- Test 3: End-to-End Application Flow ---');
    // Create a fresh test student to guarantee deterministic execution without conflicting prior applications
    const studentRes = await httpRequest({
      hostname: 'localhost',
      port: 3003,
      path: '/api/v1/students',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'E2E Candidate ' + Date.now(),
      email: `candidate_${Date.now()}@rit.edu`,
      branch: 'CSE',
      cgpa: 8.8,
      backlogs: 0,
      attendance: 90,
      skills: ['JavaScript', 'Python', 'SQL'],
    });
    assert(studentRes.status === 201 && studentRes.data.data.student_id, 'Created new test student in Team C');
    const testStudentId = studentRes.data.data.student_id;
    const idempotencyKey = 'idemp-e2e-' + Date.now();

    const applyPayload = {
      student_id: testStudentId,
      drive_id: 'DRV001',   // SDE Intern 2026, requires JavaScript, Python
      consent: true,
      resume_version: 'v1.0',
      idempotency_key: idempotencyKey,
    };

    const applyRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/applications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'e2e-apply-1',
        'Idempotency-Key': idempotencyKey,
      },
    }, applyPayload);

    assert(applyRes.status === 201 || applyRes.status === 200, `Application returned HTTP ${applyRes.status}`);
    const appData = applyRes.data.data;
    assert(appData && appData.application, 'Response includes application record');
    assert(['APPLIED', 'RULE_EVALUATED', 'SHORTLISTED'].includes(appData.application.state), `State is valid: ${appData.application.state}`);
    assert(appData.eligibility && appData.eligibility.result === 'ELIGIBLE', 'Team A evaluated student as ELIGIBLE');
    console.log('DEBUG ranking:', JSON.stringify(appData.ranking));
    assert(appData.ranking && Array.isArray(appData.ranking.ordered_candidates), 'Team B generated ranking');

    // ----------------------------------------------------
    // TEST 4: Idempotency Enforcement
    // ----------------------------------------------------
    console.log('\n--- Test 4: Idempotency Verification ---');
    const retryRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/applications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'e2e-apply-retry',
        'Idempotency-Key': idempotencyKey,
      },
    }, applyPayload);

    assert(retryRes.status === 200 || retryRes.status === 201, 'Retrying same idempotency key succeeds');
    assert(retryRes.data.data.application.application_id === appData.application.application_id, 'Same application_id returned without duplicating row');

    // ----------------------------------------------------
    // TEST 5: Team A Rule Strategies & Concurrency/Deadlocks
    // ----------------------------------------------------
    console.log('\n--- Test 5: Team A OS Rule Strategies & Deadlock Engine ---');
    // Test Decision Tree rule strategy directly
    const evalRes = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/internal/v1/rules/evaluate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': 'e2e-teama-rules' },
    }, {
      student: { student_id: 'STU001', branch: 'CSE', cgpa: 8.9, backlogs: 0, attendance: 88, skills: ['JavaScript', 'Python'] },
      drive: { drive_id: 'DRV001', criteria_json: JSON.stringify({ min_cgpa: 7.0, max_backlogs: 1, branches: ['CSE', 'IT'], min_attendance: 75, required_skills: ['JavaScript'] }) },
      strategy: 'DECISION_TREE',
    });
    assert(evalRes.status === 200 && evalRes.data.data.eligibility_result === 'ELIGIBLE', 'Team A DecisionTree evaluates correctly');

    // Test Mutex Lock & Deadlock Detection
    const lock1 = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/internal/v1/locks/acquire',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { slot_id: 'SLOT-001', holder_id: 'STU001', lock_mode: 'EXCLUSIVE', lease_timeout_ms: 5000 });
    assert(lock1.status === 201 && lock1.data.data.lock_granted === true, 'Slot mutex acquired');

    const lock2Conflict = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/internal/v1/locks/acquire',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { slot_id: 'SLOT-001', holder_id: 'STU002', lock_mode: 'EXCLUSIVE' });
    assert(lock2Conflict.status === 200 && lock2Conflict.data.data.lock_granted === false, 'Conflicting lock correctly denied');

    // Analyze deadlocks
    const deadlockRes = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/internal/v1/deadlocks/analyse',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert(deadlockRes.status === 200 && deadlockRes.data.data !== undefined, 'Deadlock analyzer returns cycle report');

    // Release lock
    const releaseRes = await httpRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/internal/v1/locks/${lock1.data.data.lease_id}`,
      method: 'DELETE',
    });
    assert(releaseRes.status === 200 && releaseRes.data.data.released === true, 'Slot mutex lease released');

    // ----------------------------------------------------
    // TEST 6: Team B Ranking & AVL Tree Shortlist Index
    // ----------------------------------------------------
    console.log('\n--- Test 6: Team B Ranking & AVL Tree Shortlist Index ---');
    const rankingCompute = await httpRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/v1/rankings/compute',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { drive_id: 'DRV001', algorithm: 'HEAP_TOPK', k: 3 });
    assert(rankingCompute.status === 200 && rankingCompute.data.data.ordered_candidates.length > 0, 'Team B HeapTopK ranking computed');

    const avlIndex = await httpRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/internal/v1/shortlist-index/DRV001',
      method: 'GET',
    });
    assert(avlIndex.status === 200 && avlIndex.data.data.index_statistics !== undefined, 'Team B AVL Tree Index statistics retrieved in O(log N)');

    const analyticsRes = await httpRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/api/v1/analytics/analyse',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert(analyticsRes.status === 200 && analyticsRes.data.data.algorithm_benchmarks !== undefined, 'Team B Cohort & algorithm benchmarks calculated');

    // ----------------------------------------------------
    // TEST 7: Team D Dashboard Aggregation & Reports
    // ----------------------------------------------------
    console.log('\n--- Test 7: Team D Portal Aggregation & Reports ---');
    const dashboardRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/dashboard',
      method: 'GET',
    });
    assert(dashboardRes.status === 200 && dashboardRes.data.data.summary !== undefined, 'Team D Dashboard returns aggregated operational summary');

    const reportsRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/reports/placement-performance',
      method: 'GET',
    });
    assert(reportsRes.status === 200 && reportsRes.data.data !== undefined, 'Team D Reports aggregates Team C and Team B data');

    // ----------------------------------------------------
    // TEST 8: User Accounts, JWT Auth & Scoped Access Control
    // ----------------------------------------------------
    console.log('\n--- Test 8: User Accounts, JWT Auth & Scoped Access Control ---');

    // 8.1 Invalid password rejection
    const invalidLogin = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { username: 'alice', password: 'wrongpassword' });
    assert(invalidLogin.status === 401, 'Invalid credentials rejected with HTTP 401');

    // 8.2 Valid login for seeded student Alice
    const aliceLogin = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { username: 'alice', password: 'password123' });
    assert(aliceLogin.status === 200 && aliceLogin.data.data.token !== undefined, 'Alice logged in with valid JWT token');
    assert(aliceLogin.data.data.user.role === 'student' && aliceLogin.data.data.user.student_id === 'STU001', 'Alice session linked to STU001');

    const aliceToken = aliceLogin.data.data.token;

    // 8.3 Verify token via /api/v1/ui/auth/me
    const meRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${aliceToken}` },
    });
    assert(meRes.status === 200 && meRes.data.data.user.username === 'alice', 'Token verified via /api/v1/ui/auth/me');

    // 8.4 Register brand new student
    const testUsername = `david_${Date.now()}`;
    const registerRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      role: 'student',
      name: 'David Sharma',
      username: testUsername,
      email: `${testUsername}@rit.edu`,
      password: 'password123',
      studentData: {
        branch: 'CSE',
        cgpa: 9.3,
        backlogs: 0,
        attendance: 92,
        skills: ['JavaScript', 'Python', 'SQL'],
      },
    });
    assert(registerRes.status === 201 && registerRes.data.data.token !== undefined, 'New student account created and registered in Team C');
    const davidToken = registerRes.data.data.token;
    const davidStudentId = registerRes.data.data.student.student_id;
    assert(davidStudentId !== undefined, 'New student ID assigned');

    // 8.5 Apply with David's authenticated session
    const davidApply = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/applications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${davidToken}`,
      },
    }, {
      drive_id: 'DRV001',
      consent: true,
      resume_version: 'v1.0',
    });
    assert(davidApply.status === 201, 'David applied to drive using scoped session');
    assert(davidApply.data.data.application.student_id === davidStudentId, 'Application strictly scoped to David student_id');

    // 8.6 Scoped applications query
    const davidApps = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/applications',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${davidToken}` },
    });
    assert(davidApps.status === 200, 'David fetched personal applications');
    const allDavidApps = davidApps.data.data.every(a => a.student_id === davidStudentId);
    assert(allDavidApps === true, 'All returned applications belong strictly to David (isolated tenant)');

    // 8.7 Admin user list inspection
    const adminLogin = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/ui/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { username: 'admin', password: 'admin123' });
    assert(adminLogin.status === 200 && adminLogin.data.data.user.role === 'admin', 'Admin authenticated');

    const usersList = await httpRequest({
      hostname: 'localhost',
      port: 3003,
      path: '/api/v1/auth/users',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminLogin.data.data.token}` },
    });
    assert(usersList.status === 200 && Array.isArray(usersList.data.data) && usersList.data.data.length >= 5, 'Admin accessed user directory from Team C');

    console.log(`\n======================================================`);
    console.log(`ALL TESTS PASSED: ${passedCount}/${totalCount} assertions verified!`);
    console.log(`======================================================\n`);

    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('\n[E2E ERROR]:', err);
    cleanup();
    process.exit(1);
  }
}

run();

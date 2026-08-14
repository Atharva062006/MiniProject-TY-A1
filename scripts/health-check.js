/**
 * Health check — polls all service /health endpoints.
 * Usage: node scripts/health-check.js
 */
const http = require('http');

const services = [
  { name: 'Team A - Eligibility', port: 3001 },
  { name: 'Team B - Ranking',     port: 3002 },
  { name: 'Team C - Placement',   port: 3003 },
  { name: 'Team D - Portal',      port: 3000 },
];

function check(service) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${service.port}/health`, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ ...service, status: json.status, ok: res.statusCode === 200 });
        } catch {
          resolve({ ...service, status: 'parse-error', ok: false });
        }
      });
    });
    req.on('error', () => resolve({ ...service, status: 'unreachable', ok: false }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ ...service, status: 'timeout', ok: false }); });
  });
}

async function main() {
  console.log('\n🏥 APNILEAP Health Check\n');
  const results = await Promise.all(services.map(check));
  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon}  ${r.name.padEnd(30)} port ${r.port}  →  ${r.status}`);
  });
  console.log('');
}

main();

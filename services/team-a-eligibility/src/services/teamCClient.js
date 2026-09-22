// Team A — Team C HTTP Client
// Communicates with Team C (Authoritative DBMS Engine on Port 3003) via REST API.

const http = require('http');

/**
 * Fetches JSON resource from Team C.
 * @param {string} path - URL path (e.g. /api/v1/students/STU001)
 * @param {string} [correlationId] - Correlation ID to forward
 * @returns {Promise<Object>}
 */
function fetchFromTeamC(path, correlationId = 'team-a-internal') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3003,
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed.data || parsed);
          } else {
            reject(new Error(parsed.error?.message || `Team C returned HTTP ${res.statusCode}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Team C response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout connecting to Team C (port 3003)'));
    });

    req.end();
  });
}

async function getStudent(studentId, correlationId) {
  try {
    return await fetchFromTeamC(`/api/v1/students/${studentId}`, correlationId);
  } catch (err) {
    return null;
  }
}

async function getDrive(driveId, correlationId) {
  try {
    return await fetchFromTeamC(`/api/v1/drives/${driveId}`, correlationId);
  } catch (err) {
    return null;
  }
}

module.exports = {
  fetchFromTeamC,
  getStudent,
  getDrive,
};


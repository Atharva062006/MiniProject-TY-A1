/**
 * Seed deterministic test data into Team C's DB.
 * Run: node scripts/seed-data.js
 */
const path = require('path');

// Load Team C's DB directly for seeding
const Database = require(path.resolve(__dirname, '../services/team-c-placement/src/db/Database'));

async function seed() {
  const db = new Database();
  await db.initialize();

  console.log('Seeding students...');
  const students = [
    { student_id: 'STU001', name: 'Alice Sharma',  email: 'alice@rit.edu',  branch: 'CSE', cgpa: 8.9, backlogs: 0, attendance: 88, skills: ['JavaScript', 'Python', 'SQL'] },
    { student_id: 'STU002', name: 'Bob Patil',     email: 'bob@rit.edu',    branch: 'CSE', cgpa: 7.4, backlogs: 1, attendance: 75, skills: ['Java', 'Spring', 'MySQL'] },
    { student_id: 'STU003', name: 'Carol Mehta',   email: 'carol@rit.edu',  branch: 'IT',  cgpa: 9.1, backlogs: 0, attendance: 92, skills: ['React', 'Node.js', 'MongoDB'] },
    { student_id: 'STU004', name: 'Dev Kumar',     email: 'dev@rit.edu',    branch: 'CSE', cgpa: 6.8, backlogs: 2, attendance: 70, skills: ['C++', 'DSA'] },
    { student_id: 'STU005', name: 'Eva Joshi',     email: 'eva@rit.edu',    branch: 'ENTC', cgpa: 8.2, backlogs: 0, attendance: 85, skills: ['Python', 'ML', 'TensorFlow'] },
  ];
  for (const s of students) {
    const existing = db.table('students').findById(s.student_id);
    if (!existing) {
      await db.table('students').insert(s).catch(err => console.warn('Student seed warning:', s.student_id, err.message));
    }
  }

  console.log('Seeding companies...');
  const companies = [
    { company_id: 'COM001', name: 'TechCorp India', industry: 'IT Services', website: 'https://techcorp.in' },
    { company_id: 'COM002', name: 'DataSoft',       industry: 'Analytics',   website: 'https://datasoft.io' },
  ];
  for (const c of companies) {
    const existing = db.table('companies').findById(c.company_id);
    if (!existing) {
      await db.table('companies').insert(c).catch(err => console.warn('Company seed warning:', c.company_id, err.message));
    }
  }

  console.log('Seeding drives...');
  const drives = [
    {
      drive_id: 'DRV001', company_id: 'COM001', title: 'SDE Intern 2026',
      criteria_json: JSON.stringify({ min_cgpa: 7.0, max_backlogs: 1, branches: ['CSE', 'IT'], min_attendance: 75, required_skills: ['JavaScript', 'Python'] }),
      seats: 10, package: 600000, state: 'OPEN', version: 1,
    },
    {
      drive_id: 'DRV002', company_id: 'COM002', title: 'Data Analyst 2026',
      criteria_json: JSON.stringify({ min_cgpa: 8.0, max_backlogs: 0, branches: ['CSE', 'IT', 'ENTC'], min_attendance: 80, required_skills: ['Python', 'SQL'] }),
      seats: 5, package: 750000, state: 'OPEN', version: 1,
    },
  ];
  for (const d of drives) {
    const existing = db.table('drives').findById(d.drive_id);
    if (!existing) {
      await db.table('drives').insert(d).catch(err => console.warn('Drive seed warning:', d.drive_id, err.message));
    }
  }

  console.log('Seeding user accounts...');
  const bcrypt = require('bcryptjs');
  const studentSalt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('password123', studentSalt);
  const facultyPasswordHash = await bcrypt.hash('faculty123', studentSalt);
  const adminPasswordHash   = await bcrypt.hash('admin123', studentSalt);

  const users = [
    {
      user_id: 'USR-ALICE-001',
      username: 'alice',
      email: 'alice@rit.edu',
      password_hash: defaultPasswordHash,
      role: 'student',
      student_id: 'STU001',
      name: 'Alice Sharma',
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR-BOB-002',
      username: 'bob',
      email: 'bob@rit.edu',
      password_hash: defaultPasswordHash,
      role: 'student',
      student_id: 'STU002',
      name: 'Bob Patil',
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR-CAROL-003',
      username: 'carol',
      email: 'carol@rit.edu',
      password_hash: defaultPasswordHash,
      role: 'student',
      student_id: 'STU003',
      name: 'Carol Mehta',
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR-FACULTY-001',
      username: 'faculty',
      email: 'faculty@rit.edu',
      password_hash: facultyPasswordHash,
      role: 'faculty',
      student_id: null,
      name: 'Prof. Deshmukh (T&P Coordinator)',
      created_at: new Date().toISOString(),
    },
    {
      user_id: 'USR-ADMIN-001',
      username: 'admin',
      email: 'admin@rit.edu',
      password_hash: adminPasswordHash,
      role: 'admin',
      student_id: null,
      name: 'Training & Placement Officer',
      created_at: new Date().toISOString(),
    },
  ];

  for (const u of users) {
    const existing = db.table('users').findById(u.user_id);
    if (!existing) {
      await db.table('users').insert(u).catch(() => {});
    }
  }

  console.log('Seed data loaded successfully.');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });

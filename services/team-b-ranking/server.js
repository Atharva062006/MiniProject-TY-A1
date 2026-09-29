const express = require('express');
const { correlationMiddleware } = require('../../shared/correlation');
const { errorHandler } = require('../../shared/errors');

// Profile & DS components
const ProfileRegistry = require('./src/profiles/ProfileRegistry');
const RankingService = require('./src/services/rankingService');
const AnalyticsService = require('./src/services/analyticsService');

// Controllers
const ProfileController = require('./src/controllers/profileController');
const RankingController = require('./src/controllers/rankingController');
const AnalyticsController = require('./src/controllers/analyticsController');

// Routes
const { setupRoutes } = require('./src/routes');

const app = express();
app.use(express.json());
app.use(correlationMiddleware);

// Initialize Data Structures and Services
const profileRegistry = new ProfileRegistry();
const rankingService = new RankingService(profileRegistry);
const analyticsService = new AnalyticsService(profileRegistry, rankingService);

// Seed default profiles (STU001 - STU005, DRV001, DRV002)
function seedDefaultProfiles(registry) {
  registry.registerStudent('STU001', {
    student_id: 'STU001',
    name: 'Alice Sharma',
    email: 'alice@rit.edu',
    branch: 'CSE',
    cgpa: 8.9,
    backlogs: 0,
    attendance: 88,
    skills: ['JavaScript', 'Python', 'SQL'],
  });

  registry.registerStudent('STU002', {
    student_id: 'STU002',
    name: 'Bob Patil',
    email: 'bob@rit.edu',
    branch: 'CSE',
    cgpa: 7.4,
    backlogs: 1,
    attendance: 75,
    skills: ['Java', 'Spring', 'MySQL'],
  });

  registry.registerStudent('STU003', {
    student_id: 'STU003',
    name: 'Carol Mehta',
    email: 'carol@rit.edu',
    branch: 'IT',
    cgpa: 9.1,
    backlogs: 0,
    attendance: 92,
    skills: ['React', 'Node.js', 'MongoDB', 'JavaScript'],
  });

  registry.registerStudent('STU004', {
    student_id: 'STU004',
    name: 'Dev Kumar',
    email: 'dev@rit.edu',
    branch: 'CSE',
    cgpa: 6.8,
    backlogs: 2,
    attendance: 70,
    skills: ['C++', 'DSA'],
  });

  registry.registerStudent('STU005', {
    student_id: 'STU005',
    name: 'Eva Joshi',
    email: 'eva@rit.edu',
    branch: 'ENTC',
    cgpa: 8.2,
    backlogs: 0,
    attendance: 85,
    skills: ['Python', 'ML', 'TensorFlow', 'SQL'],
  });

  registry.registerDrive('DRV001', {
    drive_id: 'DRV001',
    company_id: 'COM001',
    title: 'SDE Intern 2026',
    seats: 10,
    package: 600000,
    min_cgpa: 7.0,
    max_backlogs: 1,
    branches: ['CSE', 'IT'],
    min_attendance: 75,
    required_skills: [
      { name: 'JavaScript', weight: 2 },
      { name: 'Python', weight: 1 },
    ],
  });

  registry.registerDrive('DRV002', {
    drive_id: 'DRV002',
    company_id: 'COM002',
    title: 'Data Analyst 2026',
    seats: 5,
    package: 750000,
    min_cgpa: 8.0,
    max_backlogs: 0,
    branches: ['CSE', 'IT', 'ENTC'],
    min_attendance: 80,
    required_skills: [
      { name: 'Python', weight: 2 },
      { name: 'SQL', weight: 1 },
    ],
  });
}

seedDefaultProfiles(profileRegistry);

// Health check
app.get('/health', (req, res) => res.json({ service: 'team-b-ranking', status: 'ok' }));

// Initialize Controllers
const controllers = {
  profileController: new ProfileController(profileRegistry),
  rankingController: new RankingController(rankingService),
  analyticsController: new AnalyticsController(analyticsService),
};

// Mount Routes (/api/v1 and /internal/v1)
setupRoutes(app, controllers);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Team B — Ranking Engine running on port ${PORT}`);
  });
}

module.exports = {
  app,
  server,
  profileRegistry,
  rankingService,
  analyticsService,
};

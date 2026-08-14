const express = require('express');
const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ service: 'team-a-eligibility', status: 'ok' }));

// TODO: Team A — mount eligibility, queue, lock, metrics routes
// const eligibilityRoutes = require('./src/routes/eligibility');
// const internalRoutes   = require('./src/routes/internal');
// const metricsRoutes    = require('./src/routes/metrics');
// app.use('/api/v1', eligibilityRoutes);
// app.use('/internal/v1', internalRoutes);
// app.use('/api/v1/metrics', metricsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Team A — Eligibility Engine running on port ${PORT}`));

module.exports = app;

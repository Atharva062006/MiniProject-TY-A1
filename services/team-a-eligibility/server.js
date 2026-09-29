const express = require('express');
const { correlationMiddleware } = require('../../shared/correlation');
const { errorHandler } = require('../../shared/errors');
const routes = require('./src/routes');

const app = express();
app.use(express.json());
app.use(correlationMiddleware);

// Health check
app.get('/health', (req, res) => res.json({ service: 'team-a-eligibility', status: 'ok' }));

// Mount all Team A routes
app.use(routes);

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Team A — Eligibility Engine running on port ${PORT}`));
}

module.exports = app;

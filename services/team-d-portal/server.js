const express = require('express');
const path = require('path');
const { correlationMiddleware } = require('../../shared/correlation');
const { errorHandler } = require('../../shared/errors');
const uiRoutes = require('./src/bff/routes/uiRoutes');

const app = express();

app.use(express.json());
app.use(correlationMiddleware);

// Health check endpoint
app.get('/health', (req, res) => res.json({ service: 'team-d-portal', status: 'ok' }));

// Team D — Backend-for-Frontend routes
app.use('/api/v1/ui', uiRoutes);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'src/frontend')));

// Fallback: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
});

// Centralized error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Team D — Placement Portal running on port ${PORT}`);
  });
}

module.exports = app;

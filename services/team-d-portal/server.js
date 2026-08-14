const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/frontend')));

app.get('/health', (req, res) => res.json({ service: 'team-d-portal', status: 'ok' }));

// TODO: Team D — Backend-for-Frontend routes
// const uiRoutes = require('./src/bff/routes/ui');
// app.use('/api/v1/ui', uiRoutes);

// Fallback: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Team D — Placement Portal running on port ${PORT}`));

module.exports = app;

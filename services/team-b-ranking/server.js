const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ service: 'team-b-ranking', status: 'ok' }));

// TODO: Team B — mount profile, ranking, analytics, metrics routes
// app.use('/api/v1', require('./src/routes/rankings'));
// app.use('/api/v1', require('./src/routes/profiles'));
// app.use('/api/v1/analytics', require('./src/routes/analytics'));
// app.use('/internal/v1', require('./src/routes/internal'));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Team B — Ranking Engine running on port ${PORT}`));

module.exports = app;

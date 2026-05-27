const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/project');
const entrustRoutes = require('./routes/entrust');
const recordRoutes = require('./routes/record');
const reportRoutes = require('./routes/report');
const instrumentRoutes = require('./routes/instrument');

const app = express();

app.use(cors());
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/entrusts', entrustRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/instruments', instrumentRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

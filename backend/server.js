const express = require('express');
const si = require('systeminformation');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = 3000;

// CPU Usage
app.get('/cpu', async (req, res) => {
  const cpu = await si.currentLoad();
  res.json({ cpuUsage: cpu.currentLoad.toFixed(2) });
});

// Memory Usage
app.get('/memory', async (req, res) => {
  const mem = await si.mem();
  res.json({
    total: mem.total,
    used: mem.used,
    free: mem.free
  });
});

// Processes
app.get('/processes', async (req, res) => {
  const data = await si.processes();
  const processes = data.list.slice(0, 20); // top 20
  res.json(processes);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
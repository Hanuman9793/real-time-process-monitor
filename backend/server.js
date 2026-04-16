const express = require('express');
const cors = require('cors');
const si = require('systeminformation');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// CPU Usage
app.get('/cpu', async (req, res) => {
    try {
        const load = await si.currentLoad();
        res.json({ cpuUsage: Math.round(load.currentLoad) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Memory Usage
app.get('/memory', async (req, res) => {
    try {
        const mem = await si.mem();
        res.json({
            used: mem.used,
            total: mem.total,
            usedPercent: Math.round((mem.used / mem.total) * 100)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Processes
app.get('/processes', async (req, res) => {
    try {
        const procs = await si.processes();
        const list = procs.list.map(p => ({
            pid: p.pid,
            name: p.name,
            pcpu: Math.round(p.cpu * 10) / 10,
            pmem: Math.round(p.mem * 10) / 10,
            state: p.state
        }));
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Kill Process
app.post('/kill', async (req, res) => {
    const { pid } = req.body;
    if (!pid) return res.status(400).json({ success: false, error: 'PID required' });
    try {
        process.kill(pid);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
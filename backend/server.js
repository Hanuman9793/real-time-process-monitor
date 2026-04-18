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

// Disk Usage
app.get('/disk', async (req, res) => {
    try {
        const disks = await si.fsSize();
        // Return info for the main disk (usually at index 0 or filtered by mount)
        const mainDisk = disks[0] || { use: 0, size: 0, used: 0 };
        res.json({
            usedPercent: Math.round(mainDisk.use),
            total: mainDisk.size,
            used: mainDisk.used
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Network Stats
app.get('/network', async (req, res) => {
    try {
        const stats = await si.networkStats();
        // Current implementation returns the first active interface stats
        const active = stats.find(s => s.operstate === 'up') || stats[0] || {};
        res.json({
            rx_sec: Math.round(active.rx_sec || 0),
            tx_sec: Math.round(active.tx_sec || 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System Info
app.get('/system', async (req, res) => {
    try {
        const os = await si.osInfo();
        const cpu = await si.cpu();
        const time = si.time();
        res.json({
            platform: os.platform,
            distro: os.distro,
            release: os.release,
            cpuModel: `${cpu.manufacturer} ${cpu.brand}`,
            uptime: time.uptime
        });
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
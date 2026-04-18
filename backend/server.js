const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Real-Time Broadcaster ───────────────────────────────────────────────────

async function getStats() {
  try {
    const [cpu, mem, disk, net, sys, load] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.time(),
      si.currentLoad() // This contains loadAvg
    ]);

    const activeNet = net.find(s => s.operstate === 'up') || net[0] || {};
    const mainDisk = disk[0] || { use: 0, size: 0, used: 0 };

    return {
      cpu: {
        usage: Math.round(cpu.currentLoad),
        loadAvg: (load.avgLoad && Array.isArray(load.avgLoad)) 
          ? load.avgLoad.map(v => Math.round(v * 100) / 100)
          : [0, 0, 0]
      },
      mem: {
        used: mem.used,
        total: mem.total,
        usedPercent: Math.round((mem.used / mem.total) * 100)
      },
      disk: {
        used: mainDisk.used,
        total: mainDisk.size,
        usedPercent: Math.round(mainDisk.use)
      },
      net: {
        rx_sec: Math.round(activeNet.rx_sec || 0),
        tx_sec: Math.round(activeNet.tx_sec || 0)
      },
      uptime: sys.uptime
    };
  } catch (err) {
    console.error('Error gathering stats:', err);
    return null;
  }
}

// Broadcast every 1 second
setInterval(async () => {
  const stats = await getStats();
  if (stats) io.emit('pulse', stats);
}, 1000);

// Also broadcast processes every 2 seconds (heavier load)
setInterval(async () => {
  try {
    const procs = await si.processes();
    const list = procs.list.slice(0, 50).map(p => ({
      pid: p.pid,
      name: p.name,
      pcpu: Math.round(p.cpu * 10) / 10,
      pmem: Math.round(p.mem * 10) / 10,
      state: p.state
    }));
    io.emit('processes', list);
  } catch (err) {
    console.error('Error gathering processes:', err);
  }
}, 2000);

// ─── HTTP Endpoints (Legacy/Fallbacks) ───────────────────────────────────────

app.get('/cpu', async (req, res) => {
    const load = await si.currentLoad();
    res.json({ cpuUsage: Math.round(load.currentLoad) });
});

app.get('/memory', async (req, res) => {
    const mem = await si.mem();
    res.json({ used: mem.used, total: mem.total, usedPercent: Math.round((mem.used / mem.total) * 100) });
});

app.get('/system', async (req, res) => {
    const os = await si.osInfo();
    const cpu = await si.cpu();
    const time = si.time();
    res.json({ platform: os.platform, distro: os.distro, release: os.release, cpuModel: `${cpu.manufacturer} ${cpu.brand}`, uptime: time.uptime });
});

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

server.listen(PORT, () => {
    console.log(`PulseMonitor Core running on http://localhost:${PORT}`);
});
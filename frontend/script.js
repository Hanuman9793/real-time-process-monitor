// ─── Configuration & State ──────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';
const POLLING_INTERVAL = 2000;
const MAX_CHART_POINTS = 20;

let charts = {};
let processData = [];

// ─── Chart Initialization ───────────────────────────────────────────────────

function initCharts() {
  const chartConfigs = {
    cpu: {
      type: 'line',
      target: 'cpuChart',
      color: '#00f2ff',
      options: { scales: { y: { min: 0, max: 100 } } }
    },
    net: {
      type: 'line',
      target: 'netChart',
      color: '#00ffc3',
      options: { scales: { y: { beginAtZero: true } } }
    },
    mem: {
      type: 'doughnut',
      target: 'memChart',
      colors: ['#ff3d71', '#1e1e1e'],
      options: { cutout: '70%', plugins: { legend: { display: false } } }
    },
    disk: {
      type: 'doughnut',
      target: 'diskChart',
      colors: ['#bc00ff', '#1e1e1e'],
      options: { cutout: '70%', plugins: { legend: { display: false } } }
    }
  };

  Object.entries(chartConfigs).forEach(([key, cfg]) => {
    const ctx = document.getElementById(cfg.target).getContext('2d');
    
    if (cfg.type === 'line') {
      const gradient = ctx.createLinearGradient(0, 0, 0, 150);
      gradient.addColorStop(0, `${cfg.color}33`);
      gradient.addColorStop(1, `${cfg.color}00`);

      charts[key] = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ 
          data: [], 
          borderColor: cfg.color, 
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2
        }]},
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 800 },
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { 
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#64748b', font: { size: 10 } },
              ...cfg.options?.scales?.y
            }
          }
        }
      });
    } else {
      charts[key] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Used', 'Free'],
          datasets: [{
            data: [0, 100],
            backgroundColor: cfg.colors,
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          ...cfg.options
        }
      });
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
}

function updateLineChart(chart, value) {
  const labels = chart.data.labels;
  const data = chart.data.datasets[0].data;

  if (data.length >= MAX_CHART_POINTS) {
    data.shift();
    labels.shift();
  }
  
  data.push(value);
  labels.push('');
  chart.update('none'); 
}

// ─── Alert System ─────────────────────────────────────────────────────────────

function triggerAlert(message, level = 'warning') {
  const alertBox = document.getElementById('alertBox');
  alertBox.textContent = message;
  alertBox.className = `alert-box alert-${level} visible`;

  setTimeout(() => {
    alertBox.className = 'alert-box';
  }, 4000);
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

async function fetchSystemStatic() {
  try {
    const res = await fetch(`${BASE_URL}/system`);
    const data = await res.json();
    document.getElementById('osBadge').textContent = `${data.distro} ${data.release}`;
    document.getElementById('cpuModel').textContent = data.cpuModel;
  } catch (err) {
    console.error('Static info fetch failed');
  }
}

async function killProcess(pid) {
  if (!confirm(`Confirm termination of PID ${pid}?`)) return;
  try {
    const res = await fetch(`${BASE_URL}/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    const data = await res.json();
    if (data.success) {
      triggerAlert(`Process ${pid} killed successfully`, 'success');
      fetchData();
    } else {
      triggerAlert(`Error: ${data.error}`, 'danger');
    }
  } catch (err) {
    triggerAlert('Action failed: Server unreachable', 'danger');
  }
}

function renderProcesses() {
  const search = document.getElementById('search').value.toLowerCase();
  const sort = document.getElementById('sort').value;
  const tbody = document.getElementById('processTable');
  
  let filtered = processData.filter(p => p.name.toLowerCase().includes(search));
  filtered.sort((a, b) => sort === 'cpu' ? b.pcpu - a.pcpu : b.pmem - a.pmem);

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><span class="badge">${p.pid}</span></td>
      <td class="app-name">${p.name}</td>
      <td class="cpu-pct">${p.pcpu}%</td>
      <td class="mem-pct">${p.pmem}%</td>
      <td><span class="status-tag ${p.state}">${p.state}</span></td>
      <td><button class="kill-btn" onclick="killProcess(${p.pid})">Terminate</button></td>
    </tr>
  `).join('');

  document.getElementById('procCount').textContent = `${filtered.length} Processes`;
}

async function fetchData() {
  try {
    const [cpu, mem, disk, net, procs, sys] = await Promise.all([
      fetch(`${BASE_URL}/cpu`).then(r => r.json()),
      fetch(`${BASE_URL}/memory`).then(r => r.json()),
      fetch(`${BASE_URL}/disk`).then(r => r.json()),
      fetch(`${BASE_URL}/network`).then(r => r.json()),
      fetch(`${BASE_URL}/processes`).then(r => r.json()),
      fetch(`${BASE_URL}/system`).then(r => r.json())
    ]);

    // Updates
    document.getElementById('cpuValue').textContent = `${cpu.cpuUsage}%`;
    document.getElementById('cpuBar').style.width = `${cpu.cpuUsage}%`;
    updateLineChart(charts.cpu, cpu.cpuUsage);

    document.getElementById('memPercent').textContent = `${mem.usedPercent}%`;
    document.getElementById('memUsed').textContent = formatBytes(mem.used);
    document.getElementById('memTotal').textContent = formatBytes(mem.total);
    document.getElementById('memBar').style.width = `${mem.usedPercent}%`;
    charts.mem.data.datasets[0].data = [mem.usedPercent, 100 - mem.usedPercent];
    charts.mem.update();

    document.getElementById('diskPercent').textContent = `${disk.usedPercent}%`;
    document.getElementById('diskUsed').textContent = formatBytes(disk.used);
    charts.disk.data.datasets[0].data = [disk.usedPercent, 100 - disk.usedPercent];
    charts.disk.update();

    document.getElementById('netDown').textContent = `${(net.rx_sec / 1024).toFixed(1)} KB/s`;
    document.getElementById('netUp').textContent = `${(net.tx_sec / 1024).toFixed(1)} KB/s`;
    updateLineChart(charts.net, net.rx_sec / 1024);

    document.getElementById('uptimeDisplay').textContent = `Uptime: ${formatUptime(sys.uptime)}`;
    document.getElementById('lastUpdated').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;

    processData = procs;
    renderProcesses();

    // Contextual Alerts
    if (cpu.cpuUsage > 90) triggerAlert('Critical CPU Load Detected', 'danger');
    else if (mem.usedPercent > 85) triggerAlert('Memory usage exceeding 85%', 'warning');

  } catch (err) {
    console.error('Data sync failed:', err);
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  initCharts();
  fetchSystemStatic();
  fetchData();
  setInterval(fetchData, POLLING_INTERVAL);
});
}%</td>
        <td><span class="state-badge state-${p.state}">${p.state}</span></td>
        <td><button class="kill-btn" onclick="killProcess(${p.pid})">Kill</button></td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById('procCount').textContent = `${procs.length} processes`;
    document.getElementById('lastUpdated').textContent = 'Updated: ' + getTimestamp();

  } catch (err) {
    console.error('Fetch error:', err);
    triggerAlert('✖ Cannot reach server', 'danger');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

setInterval(fetchData, 2000);
fetchData();
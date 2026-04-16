// ─── Chart Setup ─────────────────────────────────────────────────────────────

const cpuCtx = document.getElementById('cpuChart').getContext('2d');
const memCtx = document.getElementById('memChart').getContext('2d');

const MAX_POINTS = 15;
let cpuData = [];
let memData = [];
let labels = [];

const cpuChart = new Chart(cpuCtx, {
  type: 'line',
  data: {
    labels,
    datasets: [{
      label: 'CPU Usage %',
      data: cpuData,
      borderColor: '#4fc3f7',
      backgroundColor: 'rgba(79,195,247,0.15)',
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3,
      fill: true
    }]
  },
  options: {
    animation: false,
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#aaa' }, grid: { color: '#2a2a2a' } },
      x: { ticks: { color: '#aaa', maxTicksLimit: 6 }, grid: { color: '#2a2a2a' } }
    },
    plugins: { legend: { labels: { color: '#ccc' } } }
  }
});

const memChart = new Chart(memCtx, {
  type: 'doughnut',
  data: {
    labels: ['Used', 'Free'],
    datasets: [{
      data: [0, 100],
      backgroundColor: ['#ef5350', '#1e1e1e'],
      borderWidth: 0
    }]
  },
  options: {
    cutout: '75%',
    plugins: { legend: { labels: { color: '#ccc' } } }
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? gb.toFixed(2) + ' GB' : (bytes / 1024 / 1024).toFixed(0) + ' MB';
}

function getTimestamp() {
  return new Date().toLocaleTimeString();
}

function pushChartData(value) {
  if (cpuData.length >= MAX_POINTS) {
    cpuData.shift();
    labels.shift();
  }
  cpuData.push(value);
  labels.push(getTimestamp());
  cpuChart.update();
}

// ─── Alert System ─────────────────────────────────────────────────────────────

let lastAlertTime = 0;
const ALERT_COOLDOWN_MS = 10000;

function triggerAlert(message, level = 'warning') {
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;
  lastAlertTime = now;

  const alertBox = document.getElementById('alertBox');
  alertBox.textContent = message;
  alertBox.className = `alert-box alert-${level} visible`;

  setTimeout(() => {
    alertBox.className = 'alert-box';
  }, 5000);
}

// ─── Kill Process ─────────────────────────────────────────────────────────────

async function killProcess(pid) {
  if (!confirm(`Are you sure you want to kill PID ${pid}?`)) return;
  try {
    const res = await fetch('http://localhost:3000/kill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    const data = await res.json();
    triggerAlert(data.success ? `✔ PID ${pid} terminated` : `✖ ${data.error}`, data.success ? 'success' : 'danger');
  } catch {
    triggerAlert('✖ Could not reach server', 'danger');
  }
}

// ─── Fetch & Render ───────────────────────────────────────────────────────────

async function fetchData() {
  const search = document.getElementById('search').value.toLowerCase().trim();
  const sort   = document.getElementById('sort').value;

  try {
    // CPU
    const cpuRes = await fetch('http://localhost:3000/cpu');
    const cpu = await cpuRes.json();
    const usage = cpu.cpuUsage;

    document.getElementById('cpuValue').textContent = usage + '%';
    document.getElementById('cpuBar').style.width = usage + '%';
    document.getElementById('cpuBar').style.background =
      usage > 80 ? '#ef5350' : usage > 50 ? '#ffa726' : '#4fc3f7';

    pushChartData(usage);

    if (usage > 80) triggerAlert(`⚠ High CPU Usage: ${usage}%`, 'warning');

    // Memory
    const memRes = await fetch('http://localhost:3000/memory');
    const mem = await memRes.json();

    document.getElementById('memUsed').textContent  = formatBytes(mem.used);
    document.getElementById('memTotal').textContent = formatBytes(mem.total);
    document.getElementById('memPercent').textContent = mem.usedPercent + '%';
    document.getElementById('memBar').style.width = mem.usedPercent + '%';

    memChart.data.datasets[0].data = [mem.usedPercent, 100 - mem.usedPercent];
    memChart.update();

    if (mem.usedPercent > 85) triggerAlert(`⚠ High Memory Usage: ${mem.usedPercent}%`, 'warning');

    // Processes
    const procRes = await fetch('http://localhost:3000/processes');
    let procs = await procRes.json();

    if (search) procs = procs.filter(p => p.name.toLowerCase().includes(search));

    procs.sort((a, b) => sort === 'cpu' ? b.pcpu - a.pcpu : b.pmem - a.pmem);

    const tbody = document.getElementById('processTable');
    tbody.innerHTML = '';

    procs.forEach(p => {
      const highCPU = p.pcpu > 10;
      const row = document.createElement('tr');
      if (highCPU) row.classList.add('highlight');

      row.innerHTML = `
        <td>${p.pid}</td>
        <td>${p.name}</td>
        <td>
          <div class="mini-bar-wrap">
            <div class="mini-bar" style="width:${Math.min(p.pcpu, 100)}%;background:${highCPU ? '#ef5350' : '#4fc3f7'}"></div>
            <span>${p.pcpu}%</span>
          </div>
        </td>
        <td>${p.pmem}%</td>
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
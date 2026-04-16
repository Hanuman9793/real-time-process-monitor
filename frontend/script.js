const ctx = document.getElementById('cpuChart').getContext('2d');

let cpuData = [];
let labels = [];

const cpuChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
      label: 'CPU Usage %',
      data: cpuData,
      borderWidth: 2,
      tension: 0.3
    }]
  },
  options: {
    scales: {
      y: {
        min: 0,
        max: 100
      }
    }
  }
});

async function fetchData() {

  // CPU
  const cpuRes = await fetch('http://localhost:3000/cpu');
  const cpu = await cpuRes.json();

  // Update chart
  if (cpuData.length > 10) {
    cpuData.shift();
    labels.shift();
  }

  cpuData.push(cpu.cpuUsage);
  labels.push(new Date().toLocaleTimeString());

  cpuChart.update();

  // Memory
  const memRes = await fetch('http://localhost:3000/memory');
  const mem = await memRes.json();

  document.getElementById('memory').innerText =
    (mem.used / 1024 / 1024).toFixed(2) + " MB";

  // Processes
  const procRes = await fetch('http://localhost:3000/processes');
  const procData = await procRes.json();

  const table = document.getElementById('processTable');
  table.innerHTML = '';

  procData.forEach(p => {
    const row = `
      <tr>
        <td>${p.pid}</td>
        <td>${p.name}</td>
        <td>${p.pcpu}</td>
        <td>${p.pmem.toFixed(2)}</td>
      </tr>
    `;
    table.innerHTML += row;
  });
}

setInterval(fetchData, 2000);
fetchData();
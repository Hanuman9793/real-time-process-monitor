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

const alertBox = document.getElementById('alertBox');

if (cpu.cpuUsage > 80) {
  alertBox.innerText = "⚠ High CPU Usage!";
} else {
  alertBox.innerText = "";
}
async function fetchData() {

  const searchValue = document.getElementById('search').value.toLowerCase();
  const sortValue = document.getElementById('sort').value;

  // CPU
  const cpuRes = await fetch('http://localhost:3000/cpu');
  const cpu = await cpuRes.json();

  // ALERT SYSTEM
  if (cpu.cpuUsage > 80) {
    alert("⚠ High CPU Usage!");
  }

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
  let procData = await procRes.json();

  // SEARCH FILTER
  procData = procData.filter(p =>
    p.name.toLowerCase().includes(searchValue)
  );

  // SORTING
  if (sortValue === "cpu") {
    procData.sort((a, b) => b.pcpu - a.pcpu);
  } else {
    procData.sort((a, b) => b.pmem - a.pmem);
  }

  const table = document.getElementById('processTable');
  table.innerHTML = '';

  procData.forEach(p => {

    let highlight = p.pcpu > 10 ? "style='color:red'" : "";

    const row = `
      <tr ${highlight}>
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
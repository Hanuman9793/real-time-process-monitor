async function fetchData() {
  // CPU
  const cpuRes = await fetch('http://localhost:3000/cpu');
  const cpuData = await cpuRes.json();
  document.getElementById('cpu').innerText = cpuData.cpuUsage;

  // Memory
  const memRes = await fetch('http://localhost:3000/memory');
  const memData = await memRes.json();
  document.getElementById('memory').innerText =
    (memData.used / 1024 / 1024).toFixed(2) + " MB";

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
        <td>${(p.pmem).toFixed(2)}</td>
      </tr>
    `;
    table.innerHTML += row;
  });
}

setInterval(fetchData, 2000);
fetchData();
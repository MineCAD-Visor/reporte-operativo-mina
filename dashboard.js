const API_URL =
  "https://script.google.com/macros/s/AKfycbw5Sx3tbAGdOJm8i72ce7lTrnFQLFdbntmePmpxLY05j_xA_10eXQIYMUdLMfUVO2c0/exec";

const filterMine = document.getElementById("filterMine");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const applyFilters = document.getElementById("applyFilters");
const statusText = document.getElementById("statusText");

let dailyChart = null;

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setDefaultDates() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);

  filterFrom.value = isoDate(first);
  filterTo.value = isoDate(now);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadData() {
  const mina = filterMine.value;
  const desde = filterFrom.value;
  const hasta = filterTo.value;

  if (!mina || !desde || !hasta) {
    alert("Selecciona mina y rango de fechas.");
    return;
  }

  if (desde > hasta) {
    alert("La fecha Desde no puede ser posterior a Hasta.");
    return;
  }

  applyFilters.disabled = true;
  applyFilters.textContent = "Consultando...";
  statusText.textContent = "Consultando datos...";

  removeError();

  try {
    const url =
      `${API_URL}?accion=barrenacion` +
      `&mina=${encodeURIComponent(mina)}` +
      `&desde=${encodeURIComponent(desde)}` +
      `&hasta=${encodeURIComponent(hasta)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.mensaje || "La consulta fue rechazada.");
    }

    renderDashboard(result.datos || []);

    statusText.textContent =
      `${result.totalRegistros || 0} registros · ${desde} a ${hasta}`;

  } catch (error) {
    console.error(error);
    showError(
      "No fue posible consultar los datos de barrenación. " +
      "Verifica la implementación de Apps Script y la conexión."
    );
    statusText.textContent = "Error de consulta";

  } finally {
    applyFilters.disabled = false;
    applyFilters.textContent = "Aplicar filtros";
  }
}

function renderDashboard(rows) {
  renderKpis(rows);
  renderTypeSummary(rows);
  renderMaterialSummary(rows);
  renderDailyChart(rows);
  renderTable(rows);
}

function renderKpis(rows) {
  const totalMl = rows.reduce(
    (sum, r) => sum + (Number(r.metrosLineales) || 0),
    0
  );

  const totalM3 = rows.reduce(
    (sum, r) => sum + (Number(r.m3) || 0),
    0
  );

  const mineral = rows.filter(r => r.material === "Mineral").length;
  const tepetate = rows.filter(r => r.material === "Tepetate").length;

  document.getElementById("kpiMl").textContent = `${totalMl.toFixed(2)} m`;
  document.getElementById("kpiM3").textContent = `${totalM3.toFixed(2)} m³`;
  document.getElementById("kpiMineral").textContent = mineral;
  document.getElementById("kpiTepetate").textContent = tepetate;
  document.getElementById("kpiRecords").textContent = rows.length;
}

function renderTypeSummary(rows) {
  const counts = {};

  rows.forEach(row => {
    const key = row.tipoObra || "Sin tipo";
    counts[key] = (counts[key] || 0) + 1;
  });

  const container = document.getElementById("typeSummary");
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML = `<div class="summary-item"><span>Sin datos</span><strong>0</strong></div>`;
    return;
  }

  container.innerHTML = entries
    .map(([type, count]) => `
      <div class="summary-item">
        <span>${escapeHtml(type)}</span>
        <strong>${count}</strong>
      </div>
    `)
    .join("");
}

function renderMaterialSummary(rows) {
  const stats = {
    Mineral: { registros: 0, ml: 0, m3: 0 },
    Tepetate: { registros: 0, ml: 0, m3: 0 }
  };

  rows.forEach(row => {
    const material = stats[row.material] ? row.material : null;
    if (!material) return;

    stats[material].registros += 1;
    stats[material].ml += Number(row.metrosLineales) || 0;
    stats[material].m3 += Number(row.m3) || 0;
  });

  const container = document.getElementById("materialSummary");

  container.innerHTML = `
    <div class="summary-item mineral">
      <span>Mineral</span>
      <strong>${stats.Mineral.registros} reg.</strong>
    </div>
    <div class="summary-item">
      <span>Mineral · ML</span>
      <strong class="material-mineral">${stats.Mineral.ml.toFixed(2)} m</strong>
    </div>
    <div class="summary-item">
      <span>Mineral · m³</span>
      <strong class="material-mineral">${stats.Mineral.m3.toFixed(2)} m³</strong>
    </div>
    <div class="summary-item">
      <span>Tepetate</span>
      <strong>${stats.Tepetate.registros} reg.</strong>
    </div>
    <div class="summary-item">
      <span>Tepetate · ML</span>
      <strong>${stats.Tepetate.ml.toFixed(2)} m</strong>
    </div>
    <div class="summary-item">
      <span>Tepetate · m³</span>
      <strong>${stats.Tepetate.m3.toFixed(2)} m³</strong>
    </div>
  `;
}

function renderDailyChart(rows) {
  const grouped = {};

  rows.forEach(row => {
    const date = row.fecha;

    if (!grouped[date]) {
      grouped[date] = { ml: 0, m3: 0 };
    }

    grouped[date].ml += Number(row.metrosLineales) || 0;
    grouped[date].m3 += Number(row.m3) || 0;
  });

  const labels = Object.keys(grouped).sort();
  const mlData = labels.map(d => grouped[d].ml);
  const m3Data = labels.map(d => grouped[d].m3);

  if (dailyChart) {
    dailyChart.destroy();
  }

  const ctx = document.getElementById("dailyChart");

  dailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Metros lineales",
          data: mlData
        },
        {
          label: "m³",
          data: m3Data
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderTable(rows) {
  const tbody = document.getElementById("detailBody");
  const tableCount = document.getElementById("tableCount");

  tableCount.textContent = `${rows.length} registros`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">
          No hay registros para el rango seleccionado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(row => `
      <tr class="${row.material === "Mineral" ? "mineral-row" : ""}">
        <td>${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.turno)}</td>
        <td>${escapeHtml(row.responsable)}</td>
        <td>${escapeHtml(row.obra)}</td>
        <td>${escapeHtml(row.tipoObra)}</td>
        <td>${row.metrosLineales ?? "—"}</td>
        <td>${row.m3 ?? "—"}</td>
        <td>${escapeHtml(row.material)}</td>
      </tr>
    `)
    .join("");
}

function showError(message) {
  const container = document.querySelector(".container");
  const div = document.createElement("div");
  div.id = "dashboardError";
  div.className = "error-box";
  div.textContent = message;
  container.prepend(div);
}

function removeError() {
  document.getElementById("dashboardError")?.remove();
}

applyFilters.addEventListener("click", loadData);

setDefaultDates();
loadData();

const API_URL =
  "https://script.google.com/macros/s/AKfycbzstqms0HqJ5wWqt8oECspm9VkqRy5i5cYrMQ3kY3rhYADVnttDVu2He9tZuCu44w7p/exec";

const CHART_COLORS = {
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
  magenta: "#c026d3"
};

const filterMine = document.getElementById("filterMine");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const applyFilters = document.getElementById("applyFilters");
const statusText = document.getElementById("statusText");

let dailyChart = null;
let rezDailyChart = null;

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
    const common =
      `&mina=${encodeURIComponent(mina)}` +
      `&desde=${encodeURIComponent(desde)}` +
      `&hasta=${encodeURIComponent(hasta)}`;

    const barrenacionUrl = `${API_URL}?accion=barrenacion${common}`;
    const rezagadoUrl = `${API_URL}?accion=rezagado${common}`;

    const [barrenacionResult, rezagadoResult] = await Promise.all([
      fetchModule(barrenacionUrl, "Barrenación"),
      fetchModule(rezagadoUrl, "Rezagado y acarreo")
    ]);

    if (barrenacionResult.ok) {
      renderBarrenacion(barrenacionResult.datos || []);
    } else {
      renderBarrenacion([]);
      showError(`Barrenación: ${barrenacionResult.error}`);
    }

    if (rezagadoResult.ok) {
      renderRezagado(rezagadoResult.datos || []);
    } else {
      renderRezagado([]);
      showError(`Rezagado y acarreo: ${rezagadoResult.error}`);
    }

    if (!barrenacionResult.ok && !rezagadoResult.ok) {
      throw new Error("No fue posible cargar ninguno de los módulos.");
    }

    statusText.textContent = `${desde} a ${hasta}`;

  } catch (error) {
    console.error(error);
    showError(
      `Error general de consulta: ${error.message || String(error)}`
    );
    statusText.textContent = "Error de consulta";

  } finally {
    applyFilters.disabled = false;
    applyFilters.textContent = "Aplicar filtros";
  }
}

async function fetchModule(url, moduleName) {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `${moduleName}: HTTP ${response.status}`
      };
    }

    const result = await response.json();

    if (!result.ok) {
      return {
        ok: false,
        error: result.mensaje || `${moduleName}: respuesta rechazada`
      };
    }

    return {
      ok: true,
      datos: result.datos || []
    };

  } catch (error) {
    console.error(`${moduleName}:`, error);

    return {
      ok: false,
      error: error.message || String(error)
    };
  }
}

function renderBarrenacion(rows) {
  renderKpis(rows);
  renderTypeSummary(rows);
  renderMaterialSummary(rows);
  renderDailyChart(rows);
  renderTable(rows);
}

function renderRezagado(rows) {
  renderRezagadoKpis(rows);
  renderRezagadoDailyChart(rows);
  renderEquipmentSummary(rows);
  renderRouteSummary(rows);
  renderRezagadoTable(rows);
}

function renderKpis(rows) {
  const totals = {
    ml: 0,
    m3: 0,
    mineralMl: 0,
    mineralM3: 0,
    tepetateMl: 0,
    tepetateM3: 0
  };

  rows.forEach(row => {
    const ml = Number(row.metrosLineales) || 0;
    const m3 = Number(row.m3) || 0;

    totals.ml += ml;
    totals.m3 += m3;

    if (row.material === "Mineral") {
      totals.mineralMl += ml;
      totals.mineralM3 += m3;
    }

    if (row.material === "Tepetate") {
      totals.tepetateMl += ml;
      totals.tepetateM3 += m3;
    }
  });

  document.getElementById("kpiMl").textContent = `${totals.ml.toFixed(2)} m`;
  document.getElementById("kpiM3").textContent = `${totals.m3.toFixed(2)} m³`;
  document.getElementById("kpiMineralMl").textContent = `${totals.mineralMl.toFixed(2)} m`;
  document.getElementById("kpiMineralM3").textContent = `${totals.mineralM3.toFixed(2)} m³`;
  document.getElementById("kpiTepetateMl").textContent = `${totals.tepetateMl.toFixed(2)} m`;
  document.getElementById("kpiTepetateM3").textContent = `${totals.tepetateM3.toFixed(2)} m³`;
}

function renderTypeSummary(rows) {
  const stats = {};

  rows.forEach(row => {
    const key = row.tipoObra || "Sin tipo";

    if (!stats[key]) {
      stats[key] = { ml: 0, m3: 0 };
    }

    stats[key].ml += Number(row.metrosLineales) || 0;
    stats[key].m3 += Number(row.m3) || 0;
  });

  const container = document.getElementById("typeSummary");
  const entries = Object.entries(stats);

  if (!entries.length) {
    container.innerHTML =
      `<div class="summary-item"><span>Sin datos</span><strong>—</strong></div>`;
    return;
  }

  container.innerHTML = entries
    .map(([type, values]) => {
      const pieces = [];

      if (values.ml > 0) {
        pieces.push(`${values.ml.toFixed(2)} m`);
      }

      if (values.m3 > 0) {
        pieces.push(`${values.m3.toFixed(2)} m³`);
      }

      return `
        <div class="summary-item">
          <span>${escapeHtml(type)}</span>
          <strong>${pieces.join(" · ") || "—"}</strong>
        </div>
      `;
    })
    .join("");
}

function renderMaterialSummary(rows) {
  const stats = {
    Mineral: { ml: 0, m3: 0 },
    Tepetate: { ml: 0, m3: 0 }
  };

  rows.forEach(row => {
    if (!stats[row.material]) return;

    stats[row.material].ml += Number(row.metrosLineales) || 0;
    stats[row.material].m3 += Number(row.m3) || 0;
  });

  const container = document.getElementById("materialSummary");

  container.innerHTML = `
    <div class="summary-item mineral">
      <span>Mineral · ML</span>
      <strong>${stats.Mineral.ml.toFixed(2)} m</strong>
    </div>
    <div class="summary-item mineral">
      <span>Mineral · m³</span>
      <strong>${stats.Mineral.m3.toFixed(2)} m³</strong>
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
          data: mlData,
          backgroundColor: CHART_COLORS.blue,
          borderColor: CHART_COLORS.blue,
          borderWidth: 1
        },
        {
          label: "m³",
          data: m3Data,
          backgroundColor: CHART_COLORS.green,
          borderColor: CHART_COLORS.green,
          borderWidth: 1
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


function renderRezagadoKpis(rows) {
  let total = 0;
  let mineral = 0;
  let tepetate = 0;
  let patio = 0;

  rows.forEach(row => {
    const tons = Number(row.toneladas) || 0;

    total += tons;

    if (row.material === "Mineral") {
      mineral += tons;
    }

    if (row.material === "Tepetate") {
      tepetate += tons;
    }

    if (String(row.destino || "").trim() === "Patio Superficie") {
      patio += tons;
    }
  });

  document.getElementById("kpiRezTotal").textContent = `${total.toFixed(2)} t`;
  document.getElementById("kpiRezMineral").textContent = `${mineral.toFixed(2)} t`;
  document.getElementById("kpiRezTepetate").textContent = `${tepetate.toFixed(2)} t`;
  document.getElementById("kpiRezPatio").textContent = `${patio.toFixed(2)} t`;
}

function renderRezagadoDailyChart(rows) {
  const grouped = {};

  rows.forEach(row => {
    const date = row.fecha;

    if (!grouped[date]) {
      grouped[date] = { mineral: 0, tepetate: 0 };
    }

    const tons = Number(row.toneladas) || 0;

    if (row.material === "Mineral") {
      grouped[date].mineral += tons;
    }

    if (row.material === "Tepetate") {
      grouped[date].tepetate += tons;
    }
  });

  const labels = Object.keys(grouped).sort();
  const mineralData = labels.map(d => grouped[d].mineral);
  const tepetateData = labels.map(d => grouped[d].tepetate);

  if (rezDailyChart) {
    rezDailyChart.destroy();
  }

  const ctx = document.getElementById("rezDailyChart");

  rezDailyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Mineral (t)",
          data: mineralData,
          backgroundColor: CHART_COLORS.blue,
          borderColor: CHART_COLORS.blue,
          borderWidth: 1
        },
        {
          label: "Tepetate (t)",
          data: tepetateData,
          backgroundColor: CHART_COLORS.green,
          borderColor: CHART_COLORS.green,
          borderWidth: 1
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

function renderEquipmentSummary(rows) {
  const stats = {};

  rows.forEach(row => {
    const equipment = row.equipo || "Sin equipo";

    if (!stats[equipment]) {
      stats[equipment] = 0;
    }

    stats[equipment] += Number(row.toneladas) || 0;
  });

  const entries = Object.entries(stats)
    .sort((a, b) => b[1] - a[1]);

  const container = document.getElementById("equipmentSummary");

  if (!entries.length) {
    container.innerHTML =
      `<div class="summary-item"><span>Sin datos</span><strong>—</strong></div>`;
    return;
  }

  container.innerHTML = entries
    .map(([equipment, tons]) => `
      <div class="summary-item">
        <span>${escapeHtml(equipment)}</span>
        <strong>${tons.toFixed(2)} t</strong>
      </div>
    `)
    .join("");
}

function renderRouteSummary(rows) {
  const stats = {};

  rows.forEach(row => {
    const origin = row.origen || "Sin origen";
    const destination = row.destino || "Sin destino";
    const route = `${origin} → ${destination}`;

    if (!stats[route]) {
      stats[route] = 0;
    }

    stats[route] += Number(row.toneladas) || 0;
  });

  const entries = Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const container = document.getElementById("routeSummary");

  if (!entries.length) {
    container.innerHTML =
      `<div class="summary-item"><span>Sin datos</span><strong>—</strong></div>`;
    return;
  }

  container.innerHTML = entries
    .map(([route, tons]) => `
      <div class="summary-item">
        <span>${escapeHtml(route)}</span>
        <strong>${tons.toFixed(2)} t</strong>
      </div>
    `)
    .join("");
}

function renderRezagadoTable(rows) {
  const tbody = document.getElementById("rezDetailBody");

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">
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
        <td>${escapeHtml(row.equipo)}</td>
        <td>${escapeHtml(row.material)}</td>
        <td>${escapeHtml(row.origen)}</td>
        <td>${escapeHtml(row.destino)}</td>
        <td>${row.movimientos ?? "—"}</td>
        <td>${escapeHtml(row.unidadMovimiento)}</td>
        <td>${row.toneladas == null ? "—" : Number(row.toneladas).toFixed(2)}</td>
      </tr>
    `)
    .join("");
}


function showError(message) {
  const container = document.querySelector(".container");
  const div = document.createElement("div");
  div.className = "error-box dashboard-error";
  div.textContent = message;
  container.prepend(div);
}

function removeError() {
  document.querySelectorAll(".dashboard-error").forEach(el => el.remove());
}

applyFilters.addEventListener("click", loadData);

setDefaultDates();
loadData();

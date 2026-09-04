const API_URL = "https://script.google.com/macros/s/AKfycbw5Sx3tbAGdOJm8i72ce7lTrnFQLFdbntmePmpxLY05j_xA_10eXQIYMUdLMfUVO2c0/exec";

let CATALOGOS = null;

const state = {
  barrenacion: [],
  acarreoInterno: [],
  acarreoPlanta: [],
  estadoEquipos: {}
};

const mina = document.getElementById("mina");
const fecha = document.getElementById("fecha");
const turno = document.getElementById("turno");
const responsable = document.getElementById("responsable");

const drillTipo = document.getElementById("drillTipo");
const drillMl = document.getElementById("drillMl");
const drillM3 = document.getElementById("drillM3");
const drillMaterial = document.getElementById("drillMaterial");
const saveReportButton = document.getElementById("saveReport");

fecha.value = new Date().toISOString().slice(0, 10);

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadCatalogs() {
  try {
    const response = await fetch("catalogos.json?v=3", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    CATALOGOS = await response.json();
    initializeApp();

  } catch (error) {
    console.error("No se pudo cargar catalogos.json:", error);

    const container = document.querySelector(".container");
    const warning = document.createElement("div");
    warning.className = "catalog-error";
    warning.textContent =
      "No fue posible cargar catalogos.json. Verifica que el archivo esté en la raíz del repositorio.";
    container.prepend(warning);

    disableCapture();
  }
}

function disableCapture() {
  document.querySelectorAll("input, select, button, textarea").forEach(el => {
    el.disabled = true;
  });
}

function initializeApp() {
  populateMineDependentCatalogs();
  updateDrillingMeasureFields();
  renderDrillingRows();
  renderHaulRows();
  updateHaulTotals();
  renderPlantRows();
  renderEquipmentRows();
}

function getMineConfig() {
  return CATALOGOS?.minas?.[mina.value] || null;
}

function populateMineDependentCatalogs() {
  populateDatalists();
  populateHaulEquipment();
}

function populateDatalists() {
  const mineConfig = getMineConfig();
  const obras = document.getElementById("obrasCatalogo");
  const lugares = document.getElementById("lugaresCatalogo");

  const mineObras = mineConfig?.obras || [];
  const mineLugares = mineConfig?.lugares || [];

  const obraSuggestions = [...new Set([...mineObras, ...mineLugares])];
  const lugarSuggestions = [...new Set([...mineLugares, ...mineObras])];

  obras.innerHTML = obraSuggestions
    .map(v => `<option value="${escapeHtml(v)}"></option>`)
    .join("");

  lugares.innerHTML = lugarSuggestions
    .map(v => `<option value="${escapeHtml(v)}"></option>`)
    .join("");
}

function handleMineChange() {
  const isSantaMaria = mina.value === "Santa Maria";
  document.getElementById("santaMariaOnly").classList.toggle("hidden", !isSantaMaria);

  populateMineDependentCatalogs();
  renderEquipmentRows();

  state.barrenacion = [];
  state.acarreoInterno = [];
  state.acarreoPlanta = [];

  renderDrillingRows();
  renderHaulRows();
  updateHaulTotals();
  renderPlantRows();
}

function populateHaulEquipment() {
  const select = document.getElementById("haulEquipo");
  const equipos = getMineConfig()?.equipos || [];

  const moviles = equipos.filter(e =>
    ["Scooptram", "Camión"].includes(e.tipo)
  );

  select.innerHTML = `
    <option value="">Seleccionar</option>
    ${moviles
      .map(e => `<option value="${escapeHtml(e.nombre)}">${escapeHtml(e.nombre)}</option>`)
      .join("")}
  `;
}

function updateDrillingMeasureFields() {
  const tipo = drillTipo.value;
  const usesLinear = ["Cuele", "Contrapozo"].includes(tipo);
  const usesVolume = ["Tumbe", "Desborde"].includes(tipo);

  drillMl.disabled = !usesLinear;
  drillM3.disabled = !usesVolume;

  if (!usesLinear) drillMl.value = "";
  if (!usesVolume) drillM3.value = "";
}

function applyMineralStyle(container, material) {
  container.classList.toggle("mineral-row", material === "Mineral");
}

function validateHeader() {
  if (!mina.value || !fecha.value || !turno.value || !responsable.value.trim()) {
    alert("Completa Mina, Fecha, Turno y Supervisor/Jefe de mina.");
    return false;
  }
  return true;
}

/* =========================================================
   CÁLCULO DE TONELAJE
   ========================================================= */

function getMaterialParams(material) {
  return CATALOGOS?.parametrosMaterial?.[material] || null;
}

function getYd3ToM3() {
  return Number(CATALOGOS?.conversiones?.yd3_a_m3 || 0.764554857984);
}

function calculateTons(equipment, material, movements) {
  if (!equipment) return null;

  const capacidadYd3 = Number(equipment.capacidadYd3);
  const params = getMaterialParams(material);

  const densidadTonM3 = Number(params?.densidadTonM3);
  const factorLlenado = Number(params?.factorLlenado ?? 1);
  const yd3ToM3 = getYd3ToM3();

  if (
    !Number.isFinite(capacidadYd3) ||
    capacidadYd3 <= 0 ||
    !Number.isFinite(densidadTonM3) ||
    densidadTonM3 <= 0 ||
    !Number.isFinite(factorLlenado) ||
    factorLlenado <= 0 ||
    !Number.isFinite(movements) ||
    movements <= 0
  ) {
    return null;
  }

  return movements * capacidadYd3 * yd3ToM3 * densidadTonM3 * factorLlenado;
}

/* =========================================================
   BARRENACIÓN
   ========================================================= */

function addDrillingRow() {
  const obra = document.getElementById("drillObra").value.trim();
  const tipo = drillTipo.value;
  const material = drillMaterial.value;
  const ml = drillMl.value;
  const m3 = drillM3.value;

  if (!mina.value) {
    alert("Selecciona primero la mina.");
    return;
  }

  if (!obra || !tipo || !material) {
    alert("Completa Obra, Tipo de obra y Material.");
    return;
  }

  if (["Cuele", "Contrapozo"].includes(tipo) && !(Number(ml) > 0)) {
    alert("Para Cuele y Contrapozo debes capturar metros lineales.");
    return;
  }

  if (["Tumbe", "Desborde"].includes(tipo) && !(Number(m3) > 0)) {
    alert("Para Tumbe y Desborde debes capturar m³.");
    return;
  }

  state.barrenacion.push({
    id: uid(),
    obra,
    tipo,
    metrosLineales: ml ? Number(ml) : null,
    m3: m3 ? Number(m3) : null,
    material
  });

  document.getElementById("drillObra").value = "";
  drillTipo.value = "";
  drillMl.value = "";
  drillM3.value = "";
  drillMaterial.value = "";

  updateDrillingMeasureFields();
  applyMineralStyle(document.getElementById("drillingEntry"), "");
  renderDrillingRows();
}

function renderDrillingRows() {
  const container = document.getElementById("drillingRows");

  if (!state.barrenacion.length) {
    container.innerHTML = `<div class="empty-state">Sin registros de barrenación.</div>`;
    return;
  }

  container.innerHTML = state.barrenacion.map(item => `
    <div class="data-row drilling-grid ${item.material === "Mineral" ? "mineral-row" : ""}">
      <span>${escapeHtml(item.obra)}</span>
      <span>${escapeHtml(item.tipo)}</span>
      <span>${item.metrosLineales ?? "—"}</span>
      <span>${item.m3 ?? "—"}</span>
      <span>${escapeHtml(item.material)}</span>
      <button class="delete-button" type="button" data-delete-drilling="${item.id}" aria-label="Eliminar">×</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-drilling]").forEach(button => {
    button.addEventListener("click", () => {
      state.barrenacion = state.barrenacion.filter(
        x => x.id !== button.dataset.deleteDrilling
      );
      renderDrillingRows();
    });
  });
}

/* =========================================================
   REZAGADO Y ACARREO
   ========================================================= */

function getEquipment(name) {
  const equipos = getMineConfig()?.equipos || [];
  return equipos.find(e => e.nombre === name);
}

function movementUnitForEquipment(equipment) {
  return equipment?.tipo === "Scooptram" ? "Cucharones" : "Viajes";
}

function addHaulRow() {
  const equipoNombre = document.getElementById("haulEquipo").value;
  const material = document.getElementById("haulMaterial").value;
  const origen = document.getElementById("haulOrigen").value.trim();
  const destino = document.getElementById("haulDestino").value.trim();
  const movimientos = Number(document.getElementById("haulMovimientos").value);

  if (!mina.value) {
    alert("Selecciona primero la mina.");
    return;
  }

  if (!equipoNombre || !material || !origen || !destino || !(movimientos > 0)) {
    alert("Completa Equipo, Material, Origen, Destino y Cucharones/Viajes.");
    return;
  }

  const equipo = getEquipment(equipoNombre);
  const toneladas = calculateTons(equipo, material, movimientos);

  state.acarreoInterno.push({
    id: uid(),
    equipo: equipoNombre,
    tipoEquipo: equipo?.tipo || "",
    material,
    origen,
    destino,
    movimientos,
    unidadMovimiento: movementUnitForEquipment(equipo),
    capacidadYd3: Number(equipo?.capacidadYd3 || 0),
    toneladas
  });

  document.getElementById("haulEquipo").value = "";
  document.getElementById("haulMaterial").value = "";
  document.getElementById("haulOrigen").value = "";
  document.getElementById("haulDestino").value = "";
  document.getElementById("haulMovimientos").value = "";

  applyMineralStyle(document.getElementById("haulEntry"), "");
  renderHaulRows();
  updateHaulTotals();
}

function renderHaulRows() {
  const container = document.getElementById("haulRows");

  if (!state.acarreoInterno.length) {
    container.innerHTML = `<div class="empty-state">Sin movimientos registrados.</div>`;
    return;
  }

  container.innerHTML = state.acarreoInterno.map(item => `
    <div class="data-row haul-grid ${item.material === "Mineral" ? "mineral-row" : ""}">
      <span>${escapeHtml(item.equipo)}</span>
      <span>${escapeHtml(item.material)}</span>
      <span>${escapeHtml(item.origen)}</span>
      <span>${escapeHtml(item.destino)}</span>
      <span>${item.movimientos} ${item.unidadMovimiento.toLowerCase()}</span>
      <button class="delete-button" type="button" data-delete-haul="${item.id}" aria-label="Eliminar">×</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-haul]").forEach(button => {
    button.addEventListener("click", () => {
      state.acarreoInterno = state.acarreoInterno.filter(
        x => x.id !== button.dataset.deleteHaul
      );
      renderHaulRows();
      updateHaulTotals();
    });
  });
}

function updateHaulTotals() {
  let buckets = 0;
  let trips = 0;
  let movedTons = 0;
  let extraction = 0;
  let missingCalculation = false;

  const destinoPatio =
    CATALOGOS?.destinoOficialPatio?.[mina.value] || "Patio Superficie";

  state.acarreoInterno.forEach(item => {
    if (item.unidadMovimiento === "Cucharones") {
      buckets += item.movimientos;
    }

    if (item.unidadMovimiento === "Viajes") {
      trips += item.movimientos;
    }

    if (!Number.isFinite(item.toneladas)) {
      missingCalculation = true;
      return;
    }

    movedTons += item.toneladas;

    if (item.destino === destinoPatio) {
      extraction += item.toneladas;
    }
  });

  document.getElementById("totalBuckets").textContent = buckets;
  document.getElementById("totalTrips").textContent = trips;

  document.getElementById("totalMovedTons").textContent =
    missingCalculation
      ? "Dato incompleto"
      : `${movedTons.toFixed(1)} t`;

  document.getElementById("totalExtraction").textContent =
    missingCalculation
      ? "Dato incompleto"
      : `${extraction.toFixed(1)} t`;
}

/* =========================================================
   ESTADO DE EQUIPOS
   ========================================================= */

function reasonOptions(selected = "") {
  const reasons = CATALOGOS?.motivosFueraServicio || [];

  return `
    <option value="">Seleccionar</option>
    ${reasons.map(m => `
      <option value="${escapeHtml(m)}" ${m === selected ? "selected" : ""}>
        ${escapeHtml(m)}
      </option>
    `).join("")}
  `;
}

function renderEquipmentRows() {
  const container = document.getElementById("equipmentRows");
  const equipos = getMineConfig()?.equipos || [];

  if (!mina.value) {
    container.innerHTML = `
      <div class="empty-state">
        Selecciona una mina para mostrar su parque de equipos.
      </div>`;
    return;
  }

  if (!equipos.length) {
    container.innerHTML = `
      <div class="empty-state">
        No hay equipos configurados para esta mina.
      </div>`;
    return;
  }

  const mineState = state.estadoEquipos[mina.value] || {};
  state.estadoEquipos[mina.value] = mineState;

  container.innerHTML = equipos.map((equipo, index) => {
    const saved =
      mineState[equipo.nombre] ||
      { estado: "", motivo: "", comentarios: "" };

    const className =
      saved.estado === "Disponible"
        ? "available"
        : saved.estado === "Fuera de servicio"
        ? "out"
        : "";

    return `
      <div class="equipment-row equipment-grid ${className}" data-equipment-row="${escapeHtml(equipo.nombre)}">
        <div class="equipment-name">${escapeHtml(equipo.nombre)}</div>

        <div class="radio-group">
          <label class="radio-option">
            <input
              type="radio"
              name="eq-status-${index}"
              value="Disponible"
              data-equipment-status="${escapeHtml(equipo.nombre)}"
              ${saved.estado === "Disponible" ? "checked" : ""}
            />
            Disponible
          </label>

          <label class="radio-option">
            <input
              type="radio"
              name="eq-status-${index}"
              value="Fuera de servicio"
              data-equipment-status="${escapeHtml(equipo.nombre)}"
              ${saved.estado === "Fuera de servicio" ? "checked" : ""}
            />
            Fuera de servicio
          </label>
        </div>

        <select
          data-equipment-reason="${escapeHtml(equipo.nombre)}"
          ${saved.estado === "Fuera de servicio" ? "" : "disabled"}
        >
          ${reasonOptions(saved.motivo)}
        </select>

        <input
          type="text"
          data-equipment-comment="${escapeHtml(equipo.nombre)}"
          value="${escapeHtml(saved.comentarios)}"
          placeholder="Comentarios"
        />
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-equipment-status]").forEach(radio => {
    radio.addEventListener("change", () => {
      const name = radio.dataset.equipmentStatus;
      const row = radio.closest(".equipment-row");
      const reason = row.querySelector("[data-equipment-reason]");

      const current =
        mineState[name] ||
        { estado: "", motivo: "", comentarios: "" };

      current.estado = radio.value;

      if (radio.value === "Disponible") {
        current.motivo = "";
        reason.value = "";
        reason.disabled = true;
      } else {
        reason.disabled = false;
      }

      mineState[name] = current;

      row.classList.toggle("available", radio.value === "Disponible");
      row.classList.toggle("out", radio.value === "Fuera de servicio");
    });
  });

  container.querySelectorAll("[data-equipment-reason]").forEach(select => {
    select.addEventListener("change", () => {
      const name = select.dataset.equipmentReason;
      const current =
        mineState[name] ||
        { estado: "", motivo: "", comentarios: "" };

      current.motivo = select.value;
      mineState[name] = current;
    });
  });

  container.querySelectorAll("[data-equipment-comment]").forEach(input => {
    input.addEventListener("input", () => {
      const name = input.dataset.equipmentComment;
      const current =
        mineState[name] ||
        { estado: "", motivo: "", comentarios: "" };

      current.comentarios = input.value;
      mineState[name] = current;
    });
  });
}

/* =========================================================
   ACARREO A PLANTA
   ========================================================= */

function addPlantHaulRow() {
  const toneladas = Number(document.getElementById("plantTons").value);
  const procedencia =
    document.getElementById("plantOrigin").value.trim();

  if (!(toneladas > 0) || !procedencia) {
    alert("Captura Tonelaje y Procedencia.");
    return;
  }

  state.acarreoPlanta.push({
    id: uid(),
    toneladas,
    procedencia
  });

  document.getElementById("plantTons").value = "";
  document.getElementById("plantOrigin").value = "";

  renderPlantRows();
}

function renderPlantRows() {
  const container = document.getElementById("plantRows");

  if (!state.acarreoPlanta.length) {
    container.innerHTML =
      `<div class="empty-state">Sin viajes enviados a planta.</div>`;
  } else {
    container.innerHTML = state.acarreoPlanta.map(item => `
      <div class="data-row plant-grid">
        <span>${item.toneladas.toFixed(2)} t</span>
        <span>${escapeHtml(item.procedencia)}</span>
        <button
          class="delete-button"
          type="button"
          data-delete-plant="${item.id}"
          aria-label="Eliminar"
        >×</button>
      </div>
    `).join("");

    container.querySelectorAll("[data-delete-plant]").forEach(button => {
      button.addEventListener("click", () => {
        state.acarreoPlanta = state.acarreoPlanta.filter(
          x => x.id !== button.dataset.deletePlant
        );
        renderPlantRows();
      });
    });
  }

  const total = state.acarreoPlanta.reduce(
    (sum, x) => sum + x.toneladas,
    0
  );

  document.getElementById("plantTotal").textContent =
    `${total.toFixed(2)} t`;
}

/* =========================================================
   VALIDACIÓN DEL REPORTE
   ========================================================= */

function validateEquipmentStatus() {
  if (!mina.value) return true;

  const equipos = getMineConfig()?.equipos || [];
  const mineState = state.estadoEquipos[mina.value] || {};

  for (const equipo of equipos) {
    const status = mineState[equipo.nombre];

    if (!status || !status.estado) {
      alert(`Falta indicar el estado del equipo: ${equipo.nombre}`);
      return false;
    }

    if (
      status.estado === "Fuera de servicio" &&
      !status.motivo
    ) {
      alert(
        `Selecciona el motivo de fuera de servicio para: ${equipo.nombre}`
      );
      return false;
    }
  }

  return true;
}

/* =========================================================
   CONSTRUCCIÓN DEL OBJETO DEL REPORTE
   ========================================================= */

function buildReportObject() {
  return {
    encabezado: {
      mina: mina.value,
      fecha: fecha.value,
      turno: turno.value,
      responsable: responsable.value.trim()
    },

    barrenacion: state.barrenacion,

    rezagadoAcarreo: state.acarreoInterno,

    estadoEquipos: state.estadoEquipos[mina.value] || {},

    stopeMate:
      mina.value === "Santa Maria"
        ? {
            metrosTurno: Number(
              document.getElementById("stopeTurno").value || 0
            )
          }
        : null,

    barrenoServicio:
      mina.value === "Santa Maria"
        ? {
            metrosTurno: Number(
              document.getElementById("serviceDrillTurno").value || 0
            )
          }
        : null,

    acarreoPlanta: state.acarreoPlanta,

    comentariosGenerales:
      document.getElementById("generalComments").value.trim()
  };
}

/* =========================================================
   ENVÍO A GOOGLE APPS SCRIPT
   ========================================================= */

async function sendReport(report) {
  await fetch(API_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(report)
  });
}

/* =========================================================
   GUARDAR REPORTE COMPLETO
   ========================================================= */

async function handleReportSubmit(event) {
  event.preventDefault();

  if (!validateHeader()) return;
  if (!validateEquipmentStatus()) return;

  const report = buildReportObject();

  const textoOriginal = saveReportButton.textContent;

  saveReportButton.disabled = true;
  saveReportButton.textContent = "Enviando...";

  try {
    await sendReport(report);

    alert(
      "Reporte enviado.\n\n" +
      "La información fue enviada al sistema de registro. " +
      "Puedes verificarla en Google Sheets."
    );

  } catch (error) {
    console.error("Error enviando reporte:", error);

    alert(
      "No fue posible enviar el reporte.\n\n" +
      "Revisa la conexión a Internet e inténtalo nuevamente."
    );

  } finally {
    saveReportButton.disabled = false;
    saveReportButton.textContent = textoOriginal;
  }
}


/* =========================================================
   BLOQUEO DE ENVÍO ACCIDENTAL CON ENTER
   ========================================================= */

document
  .getElementById("shiftReport")
  .addEventListener("keydown", event => {

    if (event.key !== "Enter") return;

    const target = event.target;

    /*
      En el campo de comentarios generales sí se permite Enter
      para insertar saltos de línea.
    */
    if (
      target &&
      target.tagName === "TEXTAREA" &&
      target.id === "generalComments"
    ) {
      return;
    }

    /*
      En cualquier otro control del formulario, Enter no debe
      interpretarse como Guardar reporte.
    */
    event.preventDefault();
  });

/* =========================================================
   EVENTOS
   ========================================================= */

mina.addEventListener("change", handleMineChange);
drillTipo.addEventListener("change", updateDrillingMeasureFields);

drillMaterial.addEventListener("change", () => {
  applyMineralStyle(
    document.getElementById("drillingEntry"),
    drillMaterial.value
  );
});

document
  .getElementById("haulMaterial")
  .addEventListener("change", event => {
    applyMineralStyle(
      document.getElementById("haulEntry"),
      event.target.value
    );
  });

document
  .getElementById("addDrilling")
  .addEventListener("click", addDrillingRow);

document
  .getElementById("addHaul")
  .addEventListener("click", addHaulRow);

document
  .getElementById("addPlantHaul")
  .addEventListener("click", addPlantHaulRow);

document
  .getElementById("shiftReport")
  .addEventListener("submit", handleReportSubmit);

/* =========================================================
   INICIO
   ========================================================= */

loadCatalogs();

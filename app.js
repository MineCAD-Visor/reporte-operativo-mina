/*
  PROTOTIPO DE CAPTURA
  --------------------
  Esta versión trabaja solamente en memoria.
  No envía información a Google Sheets.

  Los catálogos de prueba están concentrados al inicio de este archivo
  para que después sea sencillo sustituirlos por los catálogos reales.
*/

const CATALOGOS = {
  obras: [
    "Frente Norte 33-850",
    "Frente Sur 33-850",
    "Rebaje 11-800 Sur",
    "Rebaje 14-825 Norte",
    "Contrapozo 33-850",
    "Desborde 11-800"
  ],

  lugares: [
    "Frente Norte 33-850",
    "Frente Sur 33-850",
    "Rebaje 11-800 Sur",
    "Rebaje 14-825 Norte",
    "Tolva",
    "Patio Superficie",
    "Tepetatera"
  ],

  // factorTon = toneladas estimadas por cucharón o por viaje.
  equiposPorMina: {
    "Santa Maria": [
      { nombre: "Scoop 01", tipo: "Scooptram", factorTon: 5.5 },
      { nombre: "Scoop 02", tipo: "Scooptram", factorTon: 5.5 },
      { nombre: "Camión 01", tipo: "Camión", factorTon: 5.0 },
      { nombre: "Camión 02", tipo: "Camión", factorTon: 5.0 },
      { nombre: "Jumbo 01", tipo: "Jumbo", factorTon: 0 }
    ],
    "Unificación/Hallazgo": [
      { nombre: "Scoop 03", tipo: "Scooptram", factorTon: 5.5 },
      { nombre: "Camión 03", tipo: "Camión", factorTon: 5.0 },
      { nombre: "Camión 04", tipo: "Camión", factorTon: 5.0 },
      { nombre: "Jumbo 02", tipo: "Jumbo", factorTon: 0 }
    ]
  },

  motivosFueraServicio: [
    "Ponchadura",
    "Falla mecánica",
    "Falla eléctrica",
    "Servicio programado",
    "Mantenimiento preventivo",
    "Esperando refacción",
    "Accidente / daño",
    "Otro"
  ],

  destinoOficialPatio: "Patio Superficie"
};

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

function populateDatalists() {
  const obras = document.getElementById("obrasCatalogo");
  const lugares = document.getElementById("lugaresCatalogo");

  obras.innerHTML = CATALOGOS.obras
    .map(v => `<option value="${escapeHtml(v)}"></option>`)
    .join("");

  lugares.innerHTML = [...new Set([...CATALOGOS.lugares, ...CATALOGOS.obras])]
    .map(v => `<option value="${escapeHtml(v)}"></option>`)
    .join("");
}

function handleMineChange() {
  const isSantaMaria = mina.value === "Santa Maria";
  document.getElementById("santaMariaOnly").classList.toggle("hidden", !isSantaMaria);

  populateHaulEquipment();
  renderEquipmentRows();
}

function populateHaulEquipment() {
  const select = document.getElementById("haulEquipo");
  const equipos = CATALOGOS.equiposPorMina[mina.value] || [];
  const moviles = equipos.filter(e => ["Scooptram", "Camión"].includes(e.tipo));

  select.innerHTML = `
    <option value="">Seleccionar</option>
    ${moviles.map(e => `<option value="${escapeHtml(e.nombre)}">${escapeHtml(e.nombre)}</option>`).join("")}
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
    alert("Completa Mina, Fecha, Turno y Supervisor/Jefe de mina antes de cerrar el reporte.");
    return false;
  }
  return true;
}

/* =========================
   BARRENACIÓN
   ========================= */

function addDrillingRow() {
  const obra = document.getElementById("drillObra").value.trim();
  const tipo = drillTipo.value;
  const material = drillMaterial.value;
  const ml = drillMl.value;
  const m3 = drillM3.value;

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
      <button class="icon-button delete" type="button" data-delete-drilling="${item.id}" aria-label="Eliminar">×</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-drilling]").forEach(button => {
    button.addEventListener("click", () => {
      state.barrenacion = state.barrenacion.filter(x => x.id !== button.dataset.deleteDrilling);
      renderDrillingRows();
    });
  });
}

/* =========================
   REZAGADO Y ACARREO
   ========================= */

function getEquipment(name) {
  const equipos = CATALOGOS.equiposPorMina[mina.value] || [];
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
  const toneladas = movimientos * (equipo?.factorTon || 0);

  state.acarreoInterno.push({
    id: uid(),
    equipo: equipoNombre,
    tipoEquipo: equipo?.tipo || "",
    material,
    origen,
    destino,
    movimientos,
    unidadMovimiento: movementUnitForEquipment(equipo),
    factorTon: equipo?.factorTon || 0,
    toneladas
  });

  document.getElementById("haulEquipo").value = "";
  document.getElementById("haulMaterial").value = "";
  document.getElementById("haulOrigen").value = "";
  document.getElementById("haulDestino").value = "";
  document.getElementById("haulMovimientos").value = "";

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
      <button class="icon-button delete" type="button" data-delete-haul="${item.id}" aria-label="Eliminar">×</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-delete-haul]").forEach(button => {
    button.addEventListener("click", () => {
      state.acarreoInterno = state.acarreoInterno.filter(x => x.id !== button.dataset.deleteHaul);
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

  state.acarreoInterno.forEach(item => {
    if (item.unidadMovimiento === "Cucharones") buckets += item.movimientos;
    if (item.unidadMovimiento === "Viajes") trips += item.movimientos;
    movedTons += item.toneladas;

    if (item.destino === CATALOGOS.destinoOficialPatio) {
      extraction += item.toneladas;
    }
  });

  document.getElementById("totalBuckets").textContent = buckets;
  document.getElementById("totalTrips").textContent = trips;
  document.getElementById("totalMovedTons").textContent = `${movedTons.toFixed(1)} t`;
  document.getElementById("totalExtraction").textContent = `${extraction.toFixed(1)} t`;
}

/* =========================
   ESTADO DE EQUIPOS
   ========================= */

function reasonOptions(selected = "") {
  return `
    <option value="">Seleccionar</option>
    ${CATALOGOS.motivosFueraServicio.map(m => `
      <option value="${escapeHtml(m)}" ${m === selected ? "selected" : ""}>${escapeHtml(m)}</option>
    `).join("")}
  `;
}

function renderEquipmentRows() {
  const container = document.getElementById("equipmentRows");
  const equipos = CATALOGOS.equiposPorMina[mina.value] || [];

  if (!mina.value) {
    container.innerHTML = `<div class="empty-state">Selecciona una mina para mostrar su parque de equipos.</div>`;
    return;
  }

  if (!equipos.length) {
    container.innerHTML = `<div class="empty-state">No hay equipos configurados para esta mina.</div>`;
    return;
  }

  const mineState = state.estadoEquipos[mina.value] || {};
  state.estadoEquipos[mina.value] = mineState;

  container.innerHTML = equipos.map((equipo, index) => {
    const saved = mineState[equipo.nombre] || { estado: "", motivo: "", comentarios: "" };
    const className = saved.estado === "Disponible" ? "available" : saved.estado === "Fuera de servicio" ? "out" : "";

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
      const row = container.querySelector(`[data-equipment-row="${CSS.escape(name)}"]`);
      const reason = container.querySelector(`[data-equipment-reason="${CSS.escape(name)}"]`);
      const current = mineState[name] || { estado: "", motivo: "", comentarios: "" };

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
      const current = mineState[name] || { estado: "", motivo: "", comentarios: "" };
      current.motivo = select.value;
      mineState[name] = current;
    });
  });

  container.querySelectorAll("[data-equipment-comment]").forEach(input => {
    input.addEventListener("input", () => {
      const name = input.dataset.equipmentComment;
      const current = mineState[name] || { estado: "", motivo: "", comentarios: "" };
      current.comentarios = input.value;
      mineState[name] = current;
    });
  });
}

/* =========================
   ACARREO A PLANTA
   ========================= */

function addPlantHaulRow() {
  const toneladas = Number(document.getElementById("plantTons").value);
  const procedencia = document.getElementById("plantOrigin").value.trim();

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
    container.innerHTML = `<div class="empty-state">Sin viajes enviados a planta.</div>`;
  } else {
    container.innerHTML = state.acarreoPlanta.map(item => `
      <div class="data-row plant-grid">
        <span>${item.toneladas.toFixed(2)} t</span>
        <span>${escapeHtml(item.procedencia)}</span>
        <button class="icon-button delete" type="button" data-delete-plant="${item.id}" aria-label="Eliminar">×</button>
      </div>
    `).join("");

    container.querySelectorAll("[data-delete-plant]").forEach(button => {
      button.addEventListener("click", () => {
        state.acarreoPlanta = state.acarreoPlanta.filter(x => x.id !== button.dataset.deletePlant);
        renderPlantRows();
      });
    });
  }

  const total = state.acarreoPlanta.reduce((sum, x) => sum + x.toneladas, 0);
  document.getElementById("plantTotal").textContent = `${total.toFixed(2)} t`;
}

/* =========================
   VALIDACIÓN / RESUMEN
   ========================= */

function validateEquipmentStatus() {
  if (!mina.value) return true;

  const equipos = CATALOGOS.equiposPorMina[mina.value] || [];
  const mineState = state.estadoEquipos[mina.value] || {};

  for (const equipo of equipos) {
    const status = mineState[equipo.nombre];

    if (!status || !status.estado) {
      alert(`Falta indicar el estado del equipo: ${equipo.nombre}`);
      return false;
    }

    if (status.estado === "Fuera de servicio" && !status.motivo) {
      alert(`Selecciona el motivo de fuera de servicio para: ${equipo.nombre}`);
      return false;
    }
  }

  return true;
}

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

    stopeMate: mina.value === "Santa Maria"
      ? {
          metrosTurno: Number(document.getElementById("stopeTurno").value || 0)
        }
      : null,

    barrenoServicio: mina.value === "Santa Maria"
      ? {
          metrosTurno: Number(document.getElementById("serviceDrillTurno").value || 0)
        }
      : null,

    acarreoPlanta: state.acarreoPlanta,

    comentariosGenerales: document.getElementById("generalComments").value.trim()
  };
}

function handleReportSubmit(event) {
  event.preventDefault();

  if (!validateHeader()) return;
  if (!validateEquipmentStatus()) return;

  const report = buildReportObject();

  console.log("REPORTE PROVISIONAL:", report);

  const extraction = state.acarreoInterno
    .filter(x => x.destino === CATALOGOS.destinoOficialPatio)
    .reduce((sum, x) => sum + x.toneladas, 0);

  const plant = state.acarreoPlanta.reduce((sum, x) => sum + x.toneladas, 0);

  alert(
    `Reporte validado localmente.\n\n` +
    `${report.encabezado.mina} · ${report.encabezado.turno} · ${report.encabezado.fecha}\n` +
    `Barrenación: ${report.barrenacion.length} registros\n` +
    `Rezagado/acarreos: ${report.rezagadoAcarreo.length} registros\n` +
    `Extracción estimada a patio: ${extraction.toFixed(1)} t\n` +
    `Enviado a planta: ${plant.toFixed(1)} t\n\n` +
    `Todavía no se envió a Google Sheets.`
  );
}

/* =========================
   EVENTOS
   ========================= */

mina.addEventListener("change", handleMineChange);
drillTipo.addEventListener("change", updateDrillingMeasureFields);

drillMaterial.addEventListener("change", () => {
  applyMineralStyle(document.getElementById("drillingEntry"), drillMaterial.value);
});

document.getElementById("haulMaterial").addEventListener("change", event => {
  applyMineralStyle(document.getElementById("haulEntry"), event.target.value);
});

document.getElementById("addDrilling").addEventListener("click", addDrillingRow);
document.getElementById("addHaul").addEventListener("click", addHaulRow);
document.getElementById("addPlantHaul").addEventListener("click", addPlantHaulRow);
document.getElementById("shiftReport").addEventListener("submit", handleReportSubmit);

/* =========================
   INICIO
   ========================= */

populateDatalists();
updateDrillingMeasureFields();
handleMineChange();
renderDrillingRows();
renderHaulRows();
updateHaulTotals();
renderPlantRows();

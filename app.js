const state = {
  disparos: [],
  equipos: [],
  acarreo: [],
  ausentismo: []
};

const moduleTitles = {
  disparos: 'Obras disparadas',
  equipos: 'Equipos diésel',
  acarreo: 'Acarreo mina → planta',
  ausentismo: 'Ausentismo'
};

const mina = document.getElementById('mina');
const fecha = document.getElementById('fecha');
const turno = document.getElementById('turno');
const warning = document.getElementById('setupWarning');
const workspace = document.getElementById('workspace');
const workspaceTitle = document.getElementById('workspaceTitle');
const workspaceContext = document.getElementById('workspaceContext');
const workspaceBody = document.getElementById('workspaceBody');

fecha.value = new Date().toISOString().slice(0, 10);

function setupComplete() {
  const ok = mina.value && fecha.value && turno.value;
  warning.classList.toggle('hidden', ok);
  return ok;
}

function contextText() {
  return `${mina.value} · ${fecha.value} · ${turno.value}`;
}

document.querySelectorAll('.module-card').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!setupComplete()) return;
    openModule(btn.dataset.module);
  });
});

document.getElementById('closeWorkspace').addEventListener('click', () => {
  workspace.classList.add('hidden');
});

function openModule(name) {
  const template = document.getElementById(`tpl-${name}`);
  workspaceTitle.textContent = moduleTitles[name];
  workspaceContext.textContent = contextText();
  workspaceBody.innerHTML = '';
  workspaceBody.appendChild(template.content.cloneNode(true));
  workspace.classList.remove('hidden');
  bindForm(name);
  renderRecords(name);
  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindForm(name) {
  const form = workspaceBody.querySelector(`[data-form="${name}"]`);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    data.id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    data.mina = mina.value;
    data.fecha = fecha.value;
    data.turno = turno.value;
    state[name].push(data);
    form.reset();
    renderRecords(name);
    updateCounters();
  });
}

function recordSummary(name, item) {
  if (name === 'disparos') return `<strong>${item.obra}</strong><br><small>${item.tipo} · ${item.resultado}${item.metros ? ` · ${item.metros} m` : ''}</small>`;
  if (name === 'equipos') return `<strong>${item.equipo}</strong><br><small>${item.estado}${item.horas ? ` · ${item.horas} h` : ''}</small>`;
  if (name === 'acarreo') return `<strong>${item.unidad}</strong><br><small>${item.viajes} viajes${item.toneladas ? ` · ${item.toneladas} t` : ''}</small>`;
  return `<strong>${item.trabajador}</strong><br><small>${item.puesto} · ${item.motivo}</small>`;
}

function renderRecords(name) {
  const container = workspaceBody.querySelector(`[data-records="${name}"]`);
  if (!container) return;

  const filtered = state[name].filter(item => item.mina === mina.value && item.fecha === fecha.value && item.turno === turno.value);
  if (!filtered.length) {
    container.innerHTML = '<p class="eyebrow">Sin registros capturados en este módulo.</p>';
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="record">
      <p>${recordSummary(name, item)}</p>
      <button type="button" data-delete="${item.id}" data-module="${name}">Eliminar</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      const module = button.dataset.module;
      state[module] = state[module].filter(item => item.id !== button.dataset.delete);
      renderRecords(module);
      updateCounters();
    });
  });
}

function updateCounters() {
  document.getElementById('countDisparos').textContent = state.disparos.length;
  document.getElementById('countEquipos').textContent = state.equipos.length;
  document.getElementById('countAcarreo').textContent = state.acarreo.length;
  document.getElementById('countAusentismo').textContent = state.ausentismo.length;
}

[mina, fecha, turno].forEach(el => el.addEventListener('change', () => {
  setupComplete();
  if (!workspace.classList.contains('hidden')) workspace.classList.add('hidden');
}));

document.getElementById('closeShift').addEventListener('click', () => {
  if (!setupComplete()) return;
  const total = Object.values(state).reduce((sum, records) => sum + records.length, 0);
  alert(`Prototipo: reporte de ${mina.value}, ${turno.value}, ${fecha.value}.\nRegistros capturados en memoria: ${total}.\n\nTodavía no se envían a una base de datos.`);
});

setupComplete();
updateCounters();

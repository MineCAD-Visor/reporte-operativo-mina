const API_URL = 'https://script.google.com/macros/s/AKfycbw5Sx3tbAGdOJm8i72ce7lTrnFQLFdbntmePmpxLY05j_xA_10eXQIYMUdLMfUVO2c0/exec';

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

  workspace.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function bindForm(name) {
  const form = workspaceBody.querySelector(`[data-form="${name}"]`);

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());

    data.id = crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());

    data.mina = mina.value;
    data.fecha = fecha.value;
    data.turno = turno.value;

    if (name === 'disparos') {
      await guardarDisparo(data, form);
      return;
    }

    // Los demás módulos siguen siendo provisionales
    state[name].push(data);

    form.reset();
    renderRecords(name);
    updateCounters();
  });
}

async function guardarDisparo(data, form) {
  const submitButton = form.querySelector('button[type="submit"]');

  const textoOriginal = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = 'Guardando...';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        fecha: data.fecha,
        mina: data.mina,
        turno: data.turno,
        obra: data.obra,
        tipo: data.tipo,
        metros: data.metros || '',
        resultado: data.resultado || '',
        observaciones: data.observaciones || ''
      })
    });

    const resultado = await response.json();

    if (!resultado.ok) {
      throw new Error(resultado.mensaje || 'El servidor rechazó el registro.');
    }

    state.disparos.push(data);

    form.reset();
    renderRecords('disparos');
    updateCounters();

    alert('Disparo guardado correctamente.');

  } catch (error) {
    console.error(error);

    alert(
      'No fue posible guardar el disparo.\n\n' +
      'Revisa la conexión o la implementación de Apps Script.'
    );

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = textoOriginal;
  }
}

function recordSummary(name, item) {
  if (name === 'disparos') {
    return `
      <strong>${item.obra}</strong><br>
      <small>
        ${item.tipo} ·
        ${item.resultado}
        ${item.metros ? ` · ${item.metros} m` : ''}
      </small>
    `;
  }

  if (name === 'equipos') {
    return `
      <strong>${item.equipo}</strong><br>
      <small>
        ${item.estado}
        ${item.horas ? ` · ${item.horas} h` : ''}
      </small>
    `;
  }

  if (name === 'acarreo') {
    return `
      <strong>${item.unidad}</strong><br>
      <small>
        ${item.viajes} viajes
        ${item.toneladas ? ` · ${item.toneladas} t` : ''}
      </small>
    `;
  }

  return `
    <strong>${item.trabajador}</strong><br>
    <small>${item.puesto} · ${item.motivo}</small>
  `;
}

function renderRecords(name) {
  const container = workspaceBody.querySelector(
    `[data-records="${name}"]`
  );

  if (!container) return;

  const filtered = state[name].filter(item =>
    item.mina === mina.value &&
    item.fecha === fecha.value &&
    item.turno === turno.value
  );

  if (!filtered.length) {
    container.innerHTML =
      '<p class="eyebrow">Sin registros capturados en este módulo.</p>';
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="record">
      <p>${recordSummary(name, item)}</p>

      <button
        type="button"
        data-delete="${item.id}"
        data-module="${name}"
      >
        Eliminar
      </button>
    </div>
  `).join('');

  container.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      const module = button.dataset.module;

      state[module] = state[module].filter(
        item => item.id !== button.dataset.delete
      );

      renderRecords(module);
      updateCounters();
    });
  });
}

function updateCounters() {
  document.getElementById('countDisparos').textContent =
    state.disparos.length;

  document.getElementById('countEquipos').textContent =
    state.equipos.length;

  document.getElementById('countAcarreo').textContent =
    state.acarreo.length;

  document.getElementById('countAusentismo').textContent =
    state.ausentismo.length;
}

[mina, fecha, turno].forEach(el =>
  el.addEventListener('change', () => {
    setupComplete();

    if (!workspace.classList.contains('hidden')) {
      workspace.classList.add('hidden');
    }
  })
);

document.getElementById('closeShift').addEventListener('click', () => {
  if (!setupComplete()) return;

  const total = Object.values(state)
    .reduce((sum, records) => sum + records.length, 0);

  alert(
    `Reporte de ${mina.value}, ${turno.value}, ${fecha.value}.\n` +
    `Registros capturados en esta sesión: ${total}.`
  );
});

setupComplete();
updateCounters();

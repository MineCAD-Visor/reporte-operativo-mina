const HOJAS = {
  REPORTES: "REPORTES_TURNO",
  BARRENACION: "BARRENACION",
  REZAGADO: "REZAGADO_ACARREO",
  EQUIPOS: "ESTADO_EQUIPOS",
  STOPEMATE: "STOPEMATE",
  BARRENO_SERVICIO: "BARRENO_SERVICIO",
  ACARREO_PLANTA: "ACARREO_PLANTA"
};

const ENCABEZADOS = {
  REPORTES_TURNO: [
    "ID_REPORTE",
    "FECHA_HORA_REGISTRO",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "COMENTARIOS_GENERALES",
    "REGISTROS_BARRENACION",
    "REGISTROS_REZAGADO_ACARREO",
    "REGISTROS_EQUIPOS",
    "TONELADAS_ACARREO_PLANTA"
  ],

  BARRENACION: [
    "ID_REPORTE",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "OBRA",
    "TIPO_OBRA",
    "METROS_LINEALES",
    "M3",
    "MATERIAL"
  ],

  REZAGADO_ACARREO: [
    "ID_REPORTE",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "EQUIPO",
    "TIPO_EQUIPO",
    "MATERIAL",
    "ORIGEN",
    "DESTINO",
    "MOVIMIENTOS",
    "UNIDAD_MOVIMIENTO",
    "CAPACIDAD_YD3",
    "TONELADAS"
  ],

  ESTADO_EQUIPOS: [
    "ID_REPORTE",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "EQUIPO",
    "ESTADO",
    "MOTIVO",
    "COMENTARIOS"
  ],

  STOPEMATE: [
    "ID_REPORTE",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "METROS_TURNO"
  ],

  BARRENO_SERVICIO: [
    "ID_REPORTE",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "METROS_TURNO"
  ],

  ACARREO_PLANTA: [
    "ID_REPORTE",
    "FECHA",
    "MINA",
    "TURNO",
    "RESPONSABLE",
    "TONELAJE",
    "PROCEDENCIA"
  ]
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const accion = String(params.accion || "").trim().toLowerCase();

    if (!accion) {
      return respuestaJSON({
        ok: true,
        servicio: "Backend Reporte Operativo Mina",
        estado: "activo",
        fechaHora: new Date()
      });
    }

    if (accion === "barrenacion") {
      return consultarBarrenacion(params);
    }

    if (accion === "rezagado") {
      return consultarRezagado(params);
    }

    return respuestaJSON({
      ok: false,
      mensaje: "Acción no reconocida."
    });

  } catch (error) {
    console.error(error);

    return respuestaJSON({
      ok: false,
      mensaje: error.message || String(error)
    });
  }
}

function consultarBarrenacion(params) {
  const filtros = validarFiltrosConsulta(params);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.BARRENACION);

  if (!hoja || hoja.getLastRow() < 2) {
    return respuestaConsultaVacia(
      "barrenacion",
      filtros.mina,
      filtros.desdeTexto,
      filtros.hastaTexto
    );
  }

  const valores = hoja
    .getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn())
    .getValues();

  const datos = [];

  valores.forEach(fila => {
    const fechaFila = normalizarFechaHoja(fila[1]);
    const minaFila = String(fila[2] || "").trim();

    if (!fechaFila) return;
    if (minaFila !== filtros.mina) return;
    if (fechaFila < filtros.desde || fechaFila > filtros.hasta) return;

    datos.push({
      idReporte: fila[0] || "",
      fecha: formatearFecha(fechaFila),
      mina: minaFila,
      turno: fila[3] || "",
      responsable: fila[4] || "",
      obra: fila[5] || "",
      tipoObra: fila[6] || "",
      metrosLineales: numeroSeguro(fila[7]),
      m3: numeroSeguro(fila[8]),
      material: fila[9] || ""
    });
  });

  ordenarPorFecha(datos);

  return respuestaJSON({
    ok: true,
    accion: "barrenacion",
    mina: filtros.mina,
    desde: filtros.desdeTexto,
    hasta: filtros.hastaTexto,
    totalRegistros: datos.length,
    datos: datos
  });
}

function consultarRezagado(params) {
  const filtros = validarFiltrosConsulta(params);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(HOJAS.REZAGADO);

  if (!hoja || hoja.getLastRow() < 2) {
    return respuestaConsultaVacia(
      "rezagado",
      filtros.mina,
      filtros.desdeTexto,
      filtros.hastaTexto
    );
  }

  const valores = hoja
    .getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn())
    .getValues();

  const datos = [];

  valores.forEach(fila => {
    /*
      A ID_REPORTE
      B FECHA
      C MINA
      D TURNO
      E RESPONSABLE
      F EQUIPO
      G TIPO_EQUIPO
      H MATERIAL
      I ORIGEN
      J DESTINO
      K MOVIMIENTOS
      L UNIDAD_MOVIMIENTO
      M CAPACIDAD_YD3
      N TONELADAS
    */

    const fechaFila = normalizarFechaHoja(fila[1]);
    const minaFila = String(fila[2] || "").trim();

    if (!fechaFila) return;
    if (minaFila !== filtros.mina) return;
    if (fechaFila < filtros.desde || fechaFila > filtros.hasta) return;

    datos.push({
      idReporte: fila[0] || "",
      fecha: formatearFecha(fechaFila),
      mina: minaFila,
      turno: fila[3] || "",
      responsable: fila[4] || "",
      equipo: fila[5] || "",
      tipoEquipo: fila[6] || "",
      material: fila[7] || "",
      origen: fila[8] || "",
      destino: fila[9] || "",
      movimientos: numeroSeguro(fila[10]),
      unidadMovimiento: fila[11] || "",
      capacidadYd3: numeroSeguro(fila[12]),
      toneladas: numeroSeguro(fila[13])
    });
  });

  ordenarPorFecha(datos);

  return respuestaJSON({
    ok: true,
    accion: "rezagado",
    mina: filtros.mina,
    desde: filtros.desdeTexto,
    hasta: filtros.hastaTexto,
    totalRegistros: datos.length,
    datos: datos
  });
}

function validarFiltrosConsulta(params) {
  const mina = String(params.mina || "").trim();
  const desdeTexto = String(params.desde || "").trim();
  const hastaTexto = String(params.hasta || "").trim();

  if (!mina) {
    throw new Error("Falta el parámetro mina.");
  }

  if (!desdeTexto) {
    throw new Error("Falta el parámetro desde.");
  }

  if (!hastaTexto) {
    throw new Error("Falta el parámetro hasta.");
  }

  const desde = fechaDesdeTexto(desdeTexto);
  const hasta = fechaDesdeTexto(hastaTexto);

  if (!desde || !hasta) {
    throw new Error("Las fechas deben tener formato YYYY-MM-DD.");
  }

  if (desde > hasta) {
    throw new Error("La fecha desde no puede ser posterior a la fecha hasta.");
  }

  hasta.setHours(23, 59, 59, 999);

  return {
    mina,
    desdeTexto,
    hastaTexto,
    desde,
    hasta
  };
}

function respuestaConsultaVacia(accion, mina, desde, hasta) {
  return respuestaJSON({
    ok: true,
    accion: accion,
    mina: mina,
    desde: desde,
    hasta: hasta,
    totalRegistros: 0,
    datos: []
  });
}

function ordenarPorFecha(datos) {
  datos.sort((a, b) => {
    if (a.fecha < b.fecha) return -1;
    if (a.fecha > b.fecha) return 1;
    return 0;
  });
}

function formatearFecha(fecha) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No se recibió información en la petición.");
    }

    const reporte = JSON.parse(e.postData.contents);

    validarReporte(reporte);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    prepararHojas(ss);

    const encabezado = reporte.encabezado;

    const fecha = encabezado.fecha;
    const mina = encabezado.mina;
    const turno = encabezado.turno;
    const responsable = encabezado.responsable;

    if (reporteYaExiste(ss, fecha, mina, turno)) {
      throw new Error(
        "Ya existe un reporte registrado para " +
        mina + " / " + fecha + " / " + turno + "."
      );
    }

    const idReporte = Utilities.getUuid();
    const fechaHoraRegistro = new Date();

    const filasBarrenacion = [];

    (reporte.barrenacion || []).forEach(item => {
      filasBarrenacion.push([
        idReporte,
        fecha,
        mina,
        turno,
        responsable,
        item.obra || "",
        item.tipo || "",
        numeroONulo(item.metrosLineales),
        numeroONulo(item.m3),
        item.material || ""
      ]);
    });

    agregarFilas(
      ss.getSheetByName(HOJAS.BARRENACION),
      filasBarrenacion
    );

    const filasRezagado = [];

    (reporte.rezagadoAcarreo || []).forEach(item => {
      filasRezagado.push([
        idReporte,
        fecha,
        mina,
        turno,
        responsable,
        item.equipo || "",
        item.tipoEquipo || "",
        item.material || "",
        item.origen || "",
        item.destino || "",
        numeroONulo(item.movimientos),
        item.unidadMovimiento || "",
        numeroONulo(item.capacidadYd3),
        numeroONulo(item.toneladas)
      ]);
    });

    agregarFilas(
      ss.getSheetByName(HOJAS.REZAGADO),
      filasRezagado
    );

    const filasEquipos = [];
    const equipos = reporte.estadoEquipos || {};

    Object.keys(equipos).forEach(nombreEquipo => {
      const item = equipos[nombreEquipo];

      filasEquipos.push([
        idReporte,
        fecha,
        mina,
        turno,
        responsable,
        nombreEquipo,
        item.estado || "",
        item.motivo || "",
        item.comentarios || ""
      ]);
    });

    agregarFilas(
      ss.getSheetByName(HOJAS.EQUIPOS),
      filasEquipos
    );

    if (
      mina === "Santa Maria" &&
      reporte.stopeMate !== null &&
      reporte.stopeMate !== undefined
    ) {
      agregarFilas(
        ss.getSheetByName(HOJAS.STOPEMATE),
        [[
          idReporte,
          fecha,
          mina,
          turno,
          responsable,
          numeroONulo(reporte.stopeMate.metrosTurno)
        ]]
      );
    }

    if (
      mina === "Santa Maria" &&
      reporte.barrenoServicio !== null &&
      reporte.barrenoServicio !== undefined
    ) {
      agregarFilas(
        ss.getSheetByName(HOJAS.BARRENO_SERVICIO),
        [[
          idReporte,
          fecha,
          mina,
          turno,
          responsable,
          numeroONulo(reporte.barrenoServicio.metrosTurno)
        ]]
      );
    }

    const filasPlanta = [];
    let toneladasPlanta = 0;

    (reporte.acarreoPlanta || []).forEach(item => {
      const tonelaje = Number(item.toneladas) || 0;

      toneladasPlanta += tonelaje;

      filasPlanta.push([
        idReporte,
        fecha,
        mina,
        turno,
        responsable,
        tonelaje,
        item.procedencia || ""
      ]);
    });

    agregarFilas(
      ss.getSheetByName(HOJAS.ACARREO_PLANTA),
      filasPlanta
    );

    const filaReporte = [[
      idReporte,
      fechaHoraRegistro,
      fecha,
      mina,
      turno,
      responsable,
      reporte.comentariosGenerales || "",
      filasBarrenacion.length,
      filasRezagado.length,
      filasEquipos.length,
      toneladasPlanta
    ]];

    agregarFilas(
      ss.getSheetByName(HOJAS.REPORTES),
      filaReporte
    );

    return respuestaJSON({
      ok: true,
      mensaje: "Reporte guardado correctamente.",
      id_reporte: idReporte
    });

  } catch (error) {
    console.error(error);

    return respuestaJSON({
      ok: false,
      mensaje: error.message || String(error)
    });

  } finally {
    try {
      lock.releaseLock();
    } catch (e2) {}
  }
}

function validarReporte(reporte) {
  if (!reporte) {
    throw new Error("El reporte está vacío.");
  }

  if (!reporte.encabezado) {
    throw new Error("El reporte no contiene encabezado.");
  }

  const encabezado = reporte.encabezado;

  if (!encabezado.mina) {
    throw new Error("Falta la mina.");
  }

  if (!encabezado.fecha) {
    throw new Error("Falta la fecha.");
  }

  if (!encabezado.turno) {
    throw new Error("Falta el turno.");
  }

  if (!encabezado.responsable) {
    throw new Error("Falta Supervisor/Jefe de mina.");
  }

  const minasValidas = [
    "Santa Maria",
    "Unificación/Hallazgo"
  ];

  if (!minasValidas.includes(encabezado.mina)) {
    throw new Error("La mina indicada no es válida.");
  }
}

function prepararHojas(ss) {
  Object.keys(ENCABEZADOS).forEach(nombreHoja => {
    let hoja = ss.getSheetByName(nombreHoja);

    if (!hoja) {
      hoja = ss.insertSheet(nombreHoja);
    }

    const encabezados = ENCABEZADOS[nombreHoja];

    if (hoja.getLastRow() === 0) {
      hoja
        .getRange(1, 1, 1, encabezados.length)
        .setValues([encabezados]);

      hoja
        .getRange(1, 1, 1, encabezados.length)
        .setFontWeight("bold");

      hoja.setFrozenRows(1);
    }
  });
}

function reporteYaExiste(ss, fecha, mina, turno) {
  const hoja = ss.getSheetByName(HOJAS.REPORTES);

  if (!hoja || hoja.getLastRow() < 2) {
    return false;
  }

  const filas = hoja
    .getRange(
      2,
      3,
      hoja.getLastRow() - 1,
      3
    )
    .getDisplayValues();

  return filas.some(fila => {
    const fechaExistente = fila[0];
    const minaExistente = fila[1];
    const turnoExistente = fila[2];

    return (
      fechaExistente === String(fecha) &&
      minaExistente === String(mina) &&
      turnoExistente === String(turno)
    );
  });
}

function fechaDesdeTexto(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return null;
  }

  const partes = texto.split("-");

  const fecha = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2]),
    0,
    0,
    0,
    0
  );

  return fecha;
}

function normalizarFechaHoja(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return new Date(
      valor.getFullYear(),
      valor.getMonth(),
      valor.getDate(),
      0,
      0,
      0,
      0
    );
  }

  const texto = String(valor || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return fechaDesdeTexto(texto);
  }

  const fecha = new Date(texto);

  if (isNaN(fecha.getTime())) {
    return null;
  }

  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    0,
    0,
    0,
    0
  );
}

function agregarFilas(hoja, filas) {
  if (!filas || filas.length === 0) {
    return;
  }

  const filaInicial = hoja.getLastRow() + 1;

  hoja
    .getRange(
      filaInicial,
      1,
      filas.length,
      filas[0].length
    )
    .setValues(filas);
}

function numeroONulo(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "";
  }

  return numero;
}

function numeroSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : null;
}

function respuestaJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

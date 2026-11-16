/**
 * Terneros: puente entre la app del celular y esta planilla.
 *
 * - La app manda y pide los datos por internet a esta "aplicación web".
 * - Los datos completos se guardan en la hoja oculta "_datos".
 * - Las hojas Compras, Ventas, Stock y Gastos son para mirar (se rehacen en cada sincronización).
 * - La primera app que se conecta "reclama" la planilla con una clave; después solo
 *   se aceptan pedidos con esa clave.
 *
 * @OnlyCurrentDoc
 */

const HOJA_DATOS = '_datos';
const TABLAS = ['Compras', 'Ventas', 'Stock', 'Gastos', 'Vacas - Movimientos', 'Vacas - Gastos'];   // las que crea prepararPlantilla

/* ---------------- menú de la planilla ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Terneros')
    .addItem('Ver la dirección para la app', 'mostrarDireccion')
    .addSeparator()
    .addItem('Desconectar todos los celulares', 'reiniciarClave')
    .addToUi();
}

function mostrarDireccion() {
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  const ui = SpreadsheetApp.getUi();
  if (!/\/exec$/.test(url)) {
    ui.alert('Todavía no está activada',
      'Seguí los pasos de la hoja "Inicio": Extensiones → Apps Script → Implementar → Nueva implementación → Aplicación web.\n\n' +
      'Al terminar, Google te muestra la dirección (termina en /exec). Si ya la activaste, buscala en Implementar → Gestionar implementaciones.',
      ui.ButtonSet.OK);
    return;
  }
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px">' +
    '<p>Copiá esta dirección y pegala en la app, en el paso <b>"Pegar la dirección"</b>.</p>' +
    '<textarea id="u" readonly style="width:100%;height:80px;font-size:13px">' + url + '</textarea>' +
    '<p><button onclick="var t=document.getElementById(\'u\');t.select();document.execCommand(\'copy\');this.textContent=\'¡Copiada!\'">Copiar</button></p>' +
    '<p style="color:#666">Mandátela al celular por WhatsApp o mail.</p></div>'
  ).setWidth(460).setHeight(240);
  ui.showModalDialog(html, 'Dirección para la app');
}

function reiniciarClave() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Desconectar celulares',
    'Los celulares conectados van a dejar de sincronizar. Los datos de la planilla NO se borran.\n' +
    'Para volver a conectar, en la app: Resumen → Google Drive → Conectar.\n\n¿Seguir?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty('CLAVE');
  ui.alert('Listo. El próximo celular que se conecte va a quedar como dueño de la planilla.');
}

/* ---------------- aplicación web (lo que llama la app) ---------------- */

function doGet(e) {
  return responder(manejar((e && e.parameter) || {}));
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e.postData.contents); } catch (err) { return responder({ ok: false, error: 'pedido' }); }
  return responder(manejar(p));
}

function responder(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function manejar(p) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, error: 'ocupado' };
  try {
    const props = PropertiesService.getScriptProperties();
    const clave = props.getProperty('CLAVE');
    if (!p.clave || String(p.clave).length < 16) return { ok: false, error: 'sin_clave' };
    if (!clave) {
      if (p.accion !== 'conectar') return { ok: false, error: 'no_conectada' };
      props.setProperty('CLAVE', String(p.clave));          // la primera app que se conecta queda como dueña
    } else if (String(p.clave) !== clave) {
      return { ok: false, error: 'clave' };
    }

    const version = Number(props.getProperty('VERSION') || 0);
    const actualizado = props.getProperty('ACTUALIZADO') || null;
    const resumen = props.getProperty('RESUMEN') || '';

    if (p.accion === 'conectar' || p.accion === 'estado') {
      return { ok: true, version: version, actualizado: actualizado, resumen: resumen };
    }
    if (p.accion === 'bajar') {
      return { ok: true, version: version, actualizado: actualizado, datos: leerDatos() };
    }
    if (p.accion === 'subir') {
      // si otro celular subió algo después de la última vez que este bajó, avisamos en vez de pisar
      if (!p.forzar && Number(p.base) !== version) {
        return { ok: false, error: 'conflicto', version: version, actualizado: actualizado, resumen: resumen };
      }
      if (!p.datos || typeof p.datos !== 'object') return { ok: false, error: 'pedido' };
      escribirDatos(p.datos);
      try { escribirTablas(p.tablas || {}); } catch (err) { console.error(err); }   // las hojas para mirar son un extra
      const nueva = version + 1, ahora = new Date().toISOString();
      props.setProperties({ VERSION: String(nueva), ACTUALIZADO: ahora, RESUMEN: String(p.resumen || '') });
      return { ok: true, version: nueva, actualizado: ahora };
    }
    return { ok: false, error: 'accion' };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- guardado ---------------- */

function hojaDatos() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName(HOJA_DATOS);
  if (!h) { h = ss.insertSheet(HOJA_DATOS); h.hideSheet(); }
  return h;
}

// El JSON va en base64 y partido en celdas (una celda admite hasta 50.000 caracteres).
// Cada trozo empieza con "d" para que la planilla nunca lo tome como número o fórmula.
function escribirDatos(d) {
  const b64 = Utilities.base64EncodeWebSafe(JSON.stringify(d), Utilities.Charset.UTF_8);
  const filas = [];
  for (let i = 0; i < b64.length; i += 40000) filas.push(['d' + b64.slice(i, i + 40000)]);
  const h = hojaDatos();
  h.clear();
  const r = h.getRange(1, 1, filas.length, 1);
  r.setNumberFormat('@');
  r.setValues(filas);
}

function leerDatos() {
  const h = hojaDatos(), n = h.getLastRow();
  if (!n) return null;
  const txt = h.getRange(1, 1, n, 1).getValues().map(function (r) { return String(r[0]).slice(1); }).join('');
  if (!txt) return null;
  return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(txt)).getDataAsString('UTF-8'));
}

// Hojas para mirar: la app manda las mismas filas que exporta a Excel.
// Acepta cualquier nombre de hoja razonable, así la app puede sumar hojas nuevas (por ejemplo las de vacas)
// sin que haya que cambiar este código.
function escribirTablas(t) {
  const ss = SpreadsheetApp.getActive();
  Object.keys(t).filter(function (n) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 \-]{1,40}$/.test(n) && n !== HOJA_DATOS && n !== 'Inicio';
  }).slice(0, 15).forEach(function (nombre) {
    const filas = t[nombre];
    if (!Array.isArray(filas) || !filas.length) return;
    const ancho = Math.max.apply(null, filas.map(function (f) { return f.length; }));
    const limpio = filas.map(function (f) {
      const r = f.map(celda);
      while (r.length < ancho) r.push('');
      return r;
    });
    const h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    h.clearContents();
    h.getRange(1, 1, limpio.length, ancho).setValues(limpio);
    h.getRange(1, 1, 1, ancho).setFontWeight('bold');
    h.setFrozenRows(1);
  });
}

function celda(v) {
  if (typeof v === 'number') return isFinite(v) ? v : '';
  const s = v == null ? '' : String(v);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;                 // fechas: que la planilla las reconozca
  if (/^[=+\-@]/.test(s) || /[-\/]/.test(s)) return "'" + s;     // texto que la planilla podría convertir (fórmulas, "5-7", etc.)
  return s;
}

/* ---------------- para armar la plantilla (lo corre el armador una sola vez) ---------------- */

function prepararPlantilla() {
  const ss = SpreadsheetApp.getActive();
  let h = ss.getSheetByName('Inicio');
  if (!h) h = ss.insertSheet('Inicio', 0);
  h.clear();
  const filas = [
    ['Terneros: planilla de respaldo'],
    ['Esta planilla guarda los datos de la app. No borres ni cambies el nombre de las hojas.'],
    [''],
    ['Para conectarla con la app (una sola vez, desde la computadora):'],
    ['1. Menú Extensiones → Apps Script.'],
    ['2. Arriba a la derecha: Implementar → Nueva implementación.'],
    ['3. En el engranaje de "Seleccionar tipo", elegí: Aplicación web.'],
    ['4. Ejecutar como: Yo.   Quién tiene acceso: Cualquier usuario.   Después: Implementar.'],
    ['5. Autorizar acceso → elegí tu cuenta.'],
    ['   Si aparece "Google no ha verificado esta aplicación": Configuración avanzada → Ir a Terneros (no seguro) → Permitir.'],
    ['   Es normal: la aplicación es tuya y solo puede tocar esta planilla.'],
    ['6. Copiá la URL de la aplicación web (termina en /exec) y mandala al celular.'],
    ['7. En la app, pegala en el paso "Pegar la dirección" y tocá Conectar.'],
    [''],
    ['¿Perdiste la dirección? Menú Terneros → Ver la dirección para la app.'],
    ['Las hojas Compras, Ventas, Stock y Gastos se actualizan solas cada vez que la app sincroniza.']
  ];
  h.getRange(1, 1, filas.length, 1).setValues(filas);
  h.getRange(1, 1).setFontSize(16).setFontWeight('bold');
  h.getRange(4, 1).setFontWeight('bold');
  h.setColumnWidth(1, 900);
  TABLAS.forEach(function (n) { if (!ss.getSheetByName(n)) ss.insertSheet(n); });
  hojaDatos();
  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) { const x = ss.getSheetByName(n); if (x && ss.getSheets().length > 1) ss.deleteSheet(x); });
  PropertiesService.getScriptProperties().deleteAllProperties();   // la plantilla queda sin dueño ni datos
  ss.setActiveSheet(h);
}

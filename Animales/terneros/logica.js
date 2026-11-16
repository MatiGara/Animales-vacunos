"use strict";
/* Lógica de la app (cálculos, formatos, datos). Sin pantallas: se prueba en tests.html. */
/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const KEY = 'terneros-v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function num(v){
  let s = String(v ?? '').trim().replace(/\s|\$/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
const fmtM = n => new Intl.NumberFormat('es-AR', {style:'currency', currency:'ARS', maximumFractionDigits:0}).format(Math.round(n || 0));
const fmtN = (n, d = 0) => new Intl.NumberFormat('es-AR', {maximumFractionDigits:d, minimumFractionDigits:0}).format(n || 0);
const pad = n => String(n).padStart(2, '0');
function hoy(){ const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
const fmtF = s => s ? s.split('-').reverse().join('/') : '';
function dayNum(s){ const [y,m,d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m-1, d || 1) / 864e5); }
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const diaAFecha = n => new Date(n * 864e5).toISOString().slice(0, 10);
function periodoTxt(g){
  if (g.tipo === 'anual'){ const n = g.anios || 1; return n > 1 ? `${n} años (${g.periodo} a ${+g.periodo + n - 1})` : `año ${g.periodo}`; }
  if (g.tipo === 'dias'){ const p = periodoDias(g); return `${g.dias} días (${fmtF(g.periodo)} al ${fmtF(diaAFecha(p.end - 1))})`; }
  return `${MESES[+g.periodo.slice(5)-1]} ${g.periodo.slice(0,4)}`;
}
const signo = n => n >= 0 ? 'pos' : 'neg';
const fmtP = n => (n >= 0 ? '+' : '') + fmtN(n * 100, 1) + '%';
const mesSig = m => { let [y, mm] = m.split('-').map(Number); if (++mm > 12){ mm = 1; y++; } return `${y}-${pad(mm)}`; };
const mesAnt = m => { let [y, mm] = m.split('-').map(Number); if (--mm < 1){ mm = 12; y--; } return `${y}-${pad(mm)}`; };
const mesTxt = m => `${MESES[+m.slice(5)-1]} ${m.slice(0,4)}`;
const natSort = (a, b) => a.localeCompare(b, undefined, {numeric:true});

/* ---------- caravanas ---------- */
function parseCaravanas(txt){
  const list = [], errs = [];
  for (const tok of String(txt || '').toUpperCase().split(/[\s,;]+/).filter(Boolean)){
    const m = tok.match(/^([A-Z]*)(\d+)-([A-Z]*)(\d+)$/);
    if (m && (!m[3] || m[3] === m[1])){
      const a = +m[2], b = +m[4], w = m[2].length;
      if (b < a || b - a > 5000){ errs.push(tok); continue; }
      for (let i = a; i <= b; i++) list.push(m[1] + String(i).padStart(w, '0'));
    } else list.push(tok);
  }
  const vistos = new Set(), dups = new Set();
  list.forEach(t => vistos.has(t) ? dups.add(t) : vistos.add(t));
  return {list, errs, dups:[...dups]};
}
function rangos(list){                       // [1001,1002,1003,1010] -> "1001-1003, 1010"
  const ord = [...(list || [])].sort(natSort), out = [];
  const sp = s => { const m = s.match(/^(.*?)(\d+)$/); return m ? {p:m[1], n:+m[2], w:m[2].length} : null; };
  for (let i = 0; i < ord.length;){
    const a = sp(ord[i]); let j = i;
    if (a) while (j + 1 < ord.length){ const b = sp(ord[j+1]); if (b && b.p === a.p && b.w === a.w && b.n === a.n + (j + 1 - i)) j++; else break; }
    out.push(j > i ? `${ord[i]}-${ord[j]}` : ord[i]); i = j + 1;
  }
  return out.join(', ');
}

/* ---------- inflación ---------- */
const IKEY = KEY + '-ipc';
function loadInfl(){
  try { const d = JSON.parse(localStorage.getItem(IKEY)); if (d && d.auto) return {auto:d.auto, manual:d.manual || {}, act:d.act || null, fuente:d.fuente || ''}; } catch(e){}
  return {auto:{}, manual:{}, act:null, fuente:''};
}
let infl = loadInfl();
function saveInfl(){ try { localStorage.setItem(IKEY, JSON.stringify(infl)); } catch(e){} }
// nivel de precios por mes; los meses sin dato repiten la última inflación conocida (estimados)
function niveles(hasta){
  const p = {...infl.auto, ...infl.manual};
  const ms = Object.keys(p).filter(m => isFinite(p[m])).sort();
  if (!ms.length) return null;
  const last = ms[ms.length - 1], L = {}, est = new Set();
  let m = ms[0], v = 100, prev = p[ms[0]];
  L[mesAnt(m)] = 100;
  while (m <= hasta || m <= last){
    let pct = p[m];
    if (pct == null || !isFinite(pct)){ pct = prev; est.add(m); }
    v *= 1 + pct / 100; L[m] = v; prev = pct; m = mesSig(m);
  }
  return {L, est, last};
}

/* ---------- datos ---------- */
// Todas las listas de terneros. Usar siempre esta función al armar los datos (cargar, restaurar, sincronizar).
const dbDesde = d => ({compras:d.compras || [], ventas:d.ventas || [], gastos:d.gastos || [], personas:d.personas || [],
                       pesadas:d.pesadas || [], precios:d.precios || [],
                       fichas:d.fichas || []});      // fichas: datos extra por animal {caravana, chip, obs}
function load(){
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.compras)) return dbDesde(d); } catch(e){}
  return dbDesde({});
}
let db = load();
// Dueños: cada lote de terneros es de una persona; las crías pasadas desde Vacas son del campo.
const CAMPO_ID = 'campo';
// Un lote puede ser compartido: c.duenos = [{id, n}] = cuántos terneros del lote son de cada persona (suman la cantidad).
// Esos lotes salen solo en ventas "General" y lo que pasa con el lote se reparte en esa proporción.
const esCompartido = c => !!(c.duenos && c.duenos.length);
const duenoDe = c => c.origen === 'cria' ? CAMPO_ID : esCompartido(c) ? '__comp' : (c.dueno || '');
const nombreDueno = id => id === CAMPO_ID ? 'Campo (cría propia)' : id === '__comp' ? 'Compartido' : id ? ((db.personas || []).find(p => p.id === id) || {nombre:'(persona borrada)'}).nombre : 'Sin asignar';
// partes de un lote: [[persona, fracción]]
// (d.pct es de la primera versión, cuando se cargaba por porcentaje)
const cabDe = (c, d) => d.n != null ? d.n : c.cantidad * (d.pct || 0) / 100;
const partesDe = c => c.origen === 'cria' ? [[CAMPO_ID, 1]] : esCompartido(c) ? c.duenos.map(d => [d.id, cabDe(c, d) / c.cantidad]) : [[c.dueno || '', 1]];
const nombreLote = c => esCompartido(c) ? c.duenos.map(d => `${nombreDueno(d.id)} ${fmtN(cabDe(c, d), 1)}`).join(' · ') : nombreDueno(duenoDe(c));
function guardarLocal(){ try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e){ alert('No se pudieron guardar los datos en el celular.'); } }
function save(){ guardarLocal(); marcarCambio(); }   // todo cambio hecho por la persona se sube a Drive (si está conectado)

const bruto = x => x.modo === 'total' ? num(x.precio) : num(x.kg) * num(x.precio);
const costoCompra = c => bruto(c) + num(c.gastos);          // lo que costó el lote puesto en el campo
const netoVenta = v => bruto(v) - num(v.gastos);            // lo que quedó de la venta
const gastoTotal = g => num(g.maizCosto) + num(g.campoCosto) + num(g.veterinaria) + num(g.empleado) + num(g.otros);
function periodoDias(g){
  if (g.tipo === 'anual'){ const y = +g.periodo; return {start: dayNum(`${y}-01-01`), end: dayNum(`${y + (g.anios || 1)}-01-01`)}; }
  if (g.tipo === 'dias'){ const s = dayNum(g.periodo); return {start: s, end: s + Math.max(1, g.dias || 1)}; }
  const [y, m] = g.periodo.split('-').map(Number);
  return {start: dayNum(`${y}-${pad(m)}-01`), end: m === 12 ? dayNum(`${y+1}-01-01`) : dayNum(`${y}-${pad(m+1)}-01`)};
}
const porFecha = (a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.creado||0) - (b.creado||0);

/* ---------- cálculo: FIFO + reparto de gastos por día-animal ---------- */
function calc(data){
  const T = dayNum(hoy());
  const compras = [...data.compras].sort(porFecha);
  const ventas = [...data.ventas].sort(porFecha);
  // cada lote: rest = animales en stock = u (sin caravana) + tags (con caravana)
  const lots = compras.map(c => ({c, rest:c.cantidad, day:dayNum(c.fecha), unit:costoCompra(c)/c.cantidad, kgU:num(c.kg)/c.cantidad,
                                  tags:[...(c.caravanas || [])], u:c.cantidad - (c.caravanas || []).length}));
  const tagLot = new Map(), tagAsig = new Map();     // caravana -> lote, caravana -> fecha en que se asignó (si fue después de la compra)
  for (const L of lots){
    (L.c.caravanas || []).forEach(t => tagLot.set(t, L));
    for (const a of (L.c.asignaciones || [])) a.caravanas.forEach(t => { tagLot.set(t, L); tagAsig.set(t, a.fecha); });
  }
  const reservadas = new Set(ventas.flatMap(v => v.caravanas || []));   // caravanas que alguna venta pide por número
  // eventos en orden de fecha; el mismo día, primero se ponen caravanas y después se vende
  const eventos = [...ventas.map(v => ({v, fecha:v.fecha, o:1, creado:v.creado || 0}))];
  for (const L of lots) for (const a of (L.c.asignaciones || [])) eventos.push({a, L, fecha:a.fecha, o:0, creado:a.creado || 0});
  eventos.sort((x, y) => x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : x.o - y.o || x.creado - y.creado);
  const salida = new Map(), errores = [], asign = new Map();
  for (const ev of eventos){
    if (ev.a){                                      // asignación de caravanas posterior a la compra
      const {a, L} = ev, n = a.caravanas.length, falso = {id:'__asig', fecha:a.fecha};
      if (a.fecha < L.c.fecha) errores.push({v:falso, msg:`Las caravanas asignadas el ${fmtF(a.fecha)} son anteriores a la compra del ${fmtF(L.c.fecha)}.`});
      else if (n > L.u) errores.push({v:falso, msg:`El ${fmtF(a.fecha)} el lote del ${fmtF(L.c.fecha)} tenía solo ${L.u} animales sin caravana en stock, y se asignaron ${n} caravanas.`});
      else { L.u -= n; L.tags.push(...a.caravanas); }
      continue;
    }
    const v = ev.v, vd = dayNum(v.fecha), pm = new Map();
    // si la venta es de una persona, solo cuentan los lotes de esa persona
    const esDe = L => !v.dueno || (v.dueno === '__sin' ? duenoDe(L.c) === '' : duenoDe(L.c) === v.dueno);
    const deQuien = v.dueno ? ` de ${nombreDueno(v.dueno === '__sin' ? '' : v.dueno)}` : '';
    const pieza = L => { if (!pm.has(L)) pm.set(L, {L, n:0, tags:[]}); return pm.get(L); };
    if (v.caravanas && v.caravanas.length){        // venta por caravana
      for (const t of v.caravanas){
        const L = tagLot.get(t);
        if (!L){ errores.push({v, msg:`La caravana ${t} no figura en ninguna compra.`}); continue; }
        if (L.day > vd){ errores.push({v, msg:`La caravana ${t} se compró el ${fmtF(L.c.fecha)}, después de esta venta.`}); continue; }
        if (!esDe(L)){ errores.push({v, msg:`La caravana ${t} es de ${nombreLote(L.c)}, no${deQuien}.`}); continue; }
        if (tagAsig.has(t) && tagAsig.get(t) > v.fecha){ errores.push({v, msg:`La caravana ${t} se asignó el ${fmtF(tagAsig.get(t))}, después de esta venta.`}); continue; }
        const i = L.tags.indexOf(t);
        if (i < 0){ errores.push({v, msg: salida.has(t) ? `La caravana ${t} ya salió en la venta del ${fmtF(salida.get(t).fecha)}.` : `La caravana ${t} no está disponible a esa fecha.`}); continue; }
        L.tags.splice(i, 1); L.rest--; const p = pieza(L); p.n++; p.tags.push(t); salida.set(t, v);
      }
      // además pueden salir terneros sin caravana (los más viejos que no tienen)
      const extra = v.cantidad - v.caravanas.length;
      if (extra > 0){
        let need = extra;
        for (const L of lots){
          if (need <= 0) break;
          if (L.day > vd || L.u <= 0 || !esDe(L)) continue;
          const n = Math.min(need, L.u); L.u -= n; L.rest -= n; pieza(L).n += n; need -= n;
        }
        if (need > 0) errores.push({v, msg:`La venta del ${fmtF(v.fecha)} incluye ${extra} terneros sin caravana${deQuien}, pero a esa fecha había solo ${extra - need} sin caravana en stock.`});
      }
    } else {                                        // los más viejos salen primero
      let need = v.cantidad;
      for (const L of lots){
        if (need <= 0) break;
        if (L.day > vd || L.rest <= 0 || !esDe(L)) continue;
        const n = Math.min(need, L.rest), p = pieza(L); p.n += n;
        // dentro del lote: primero las caravanas que ninguna otra venta pidió, después los sin caravana,
        // y al final las caravanas que otra venta pide por número (para no pisarlas)
        const pick = L.tags.filter(t => !reservadas.has(t)).slice(0, n);
        let k = n - pick.length;
        const sinCar = Math.min(k, L.u); L.u -= sinCar; k -= sinCar;
        if (k > 0) pick.push(...L.tags.filter(t => reservadas.has(t)).slice(0, k));
        const s = new Set(pick); L.tags = L.tags.filter(t => !s.has(t)); pick.forEach(t => salida.set(t, v)); p.tags.push(...pick);
        L.rest -= n; need -= n;
      }
      if (need > 0) errores.push({v, msg:`La venta del ${fmtF(v.fecha)} es de ${v.cantidad} terneros${deQuien}, pero a esa fecha había solo ${v.cantidad - need} disponibles${deQuien}.`});
    }
    asign.set(v.id, {vd, pieces:[...pm.values()]});
  }
  const tagInfo = new Map();
  for (const [t, L] of tagLot) tagInfo.set(t, {L, venta: salida.get(t) || null, asig: tagAsig.get(t) || null});
  // línea de tiempo diaria
  const per = data.gastos.map(g => ({g, ...periodoDias(g)}));
  const marcas = [T, ...lots.map(L => L.day), ...ventas.map(v => dayNum(v.fecha)), ...per.flatMap(p => [p.start, p.end])];
  const D0 = Math.min(...marcas), N = Math.max(...marcas) + 2 - D0;
  const head = new Float64Array(N + 1), gd = new Float64Array(N + 1);
  for (const [, a] of asign) for (const p of a.pieces){ head[p.L.day - D0] += p.n; head[a.vd - D0] -= p.n; }
  for (const L of lots) if (L.rest > 0) head[L.day - D0] += L.rest;
  for (const p of per){ const t = gastoTotal(p.g), len = p.end - p.start; for (let d = p.start; d < p.end; d++) gd[d - D0] += t / len; }
  // inflación: nivel de precios del mes de cada día
  const NV = niveles(diaAFecha(D0 + N).slice(0, 7));
  const mesDia = new Array(N + 1);
  for (let i = 0; i <= N; i++) mesDia[i] = diaAFecha(D0 + i).slice(0, 7);
  const ix = d => Math.max(0, Math.min(N, d - D0));
  const lev = d => NV ? (NV.L[mesDia[ix(d)]] ?? null) : null;

  const cum = new Float64Array(N + 1), cumA = new Float64Array(N + 1), cumNull = new Int32Array(N + 1);
  let h = 0, sinAsignar = 0;
  for (let i = 0; i < N; i++){
    h += head[i];
    let rate = 0;
    if (h > 0.0001) rate = gd[i] / h; else if (i + D0 <= T) sinAsignar += gd[i];
    cum[i+1] = cum[i] + rate;
    const lv = NV ? NV.L[mesDia[i]] : null;
    cumA[i+1] = cumA[i] + (lv ? rate / lv : 0);
    cumNull[i+1] = cumNull[i] + (!lv && rate > 0 ? 1 : 0);
  }
  const C = d => cum[ix(d)];

  const ventasR = ventas.map(v => {
    const a = asign.get(v.id); let costo = 0, engorde = 0, dias = 0, kgC = 0, q = 0, costoR = 0, engR = 0;
    const Lv = lev(a.vd); let realOk = !!Lv, prov = false;
    for (const p of a.pieces){
      p.costo = p.n * p.L.unit; p.eng = p.n * (C(a.vd) - C(p.L.day));     // por pieza, para repartir por dueño
      costo += p.costo; engorde += p.eng; dias += p.n * (a.vd - p.L.day); kgC += p.n * p.L.kgU; q += p.n;
      const Lc = lev(p.L.day);
      if (!Lc || cumNull[ix(a.vd)] - cumNull[ix(p.L.day)] > 0) realOk = false;
      else {
        costoR += p.n * p.L.unit * Lv / Lc;                       // costo de compra llevado a pesos del día de venta
        engR += p.n * Lv * (cumA[ix(a.vd)] - cumA[ix(p.L.day)]);  // cada día de gasto llevado a pesos del día de venta
        const m1 = p.L.c.fecha.slice(0, 7), m2 = v.fecha.slice(0, 7);
        if ([...NV.est].some(m => m > m1 && m <= m2)) prov = true;
      }
    }
    const neto = netoVenta(v), gan = neto - costo - engorde, inv = costo + engorde;
    const r = {v, pieces:a.pieces, costo, engorde, neto, gan, ganU: gan / v.cantidad, pct: inv > 0 ? gan / inv : 0,
               dias: q ? dias/q : 0, kgCU: q ? kgC/q : 0, kgVU: num(v.kg) / v.cantidad, realOk:false};
    if (realOk && q){
      const ganR = neto - costoR - engR;
      Object.assign(r, {realOk:true, prov, costoR, engR, ganR, ganRU: ganR / v.cantidad,
                        pctR: costoR + engR > 0 ? ganR / (costoR + engR) : 0, inflP: costo > 0 ? costoR / costo - 1 : 0});
    }
    return r;
  });
  const stock = lots.filter(L => L.rest > 0).map(L => {
    const engU = Math.max(0, C(T + 1) - C(L.day));
    return {L, engorde: engU * L.rest, engU, dias: Math.max(0, T - L.day)};
  });
  const vendidosPorLote = new Map(lots.map(L => [L.c.id, L.c.cantidad - L.rest]));
  return {ventasR, stock, lots, errores, sinAsignar, vendidosPorLote, tagInfo, NV,
          enStock: stock.reduce((s, x) => s + x.L.rest, 0)};
}

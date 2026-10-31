/* Mi Patrimonio — app de seguimiento de patrimonio.
 * Todo se guarda en este dispositivo (localStorage). Nada se envía a ningún servidor.
 * Usa «Más → Copia de seguridad» para exportar o importar tus datos en JSON. */
'use strict';

/* ───────────────────────── Datos y almacenamiento ───────────────────────── */

const KEY = 'patrimonio-v1';

const GRUPOS = ['Liquidez', 'Efectivo', 'Apartado para el coche', 'Fondo de emergencia', 'Cuenta remunerada', 'Inversión', 'Otros'];
const DESTINOS = ['Trade Republic', 'Cartera indexada (MyInvestor)', 'Fondo de emergencia', 'Otro'];
const TIPOS_FONDO = ['Renta variable', 'Renta fija'];

const DEFAULT_CONFIG = {
  nombre: '',
  mesesColchon: 6,   // meses de gastos que debe cubrir el colchón
  pctTR: 0.35,       // parte de lo que sobra que va a la cuenta remunerada
  margen: 250,       // € que se quedan en la cuenta corriente además de los gastos previstos
  cuotaCoche: 0      // € al mes de la cuota del coche (0 = no mostrar)
};

/* Cada tabla editable: columnas, tipo y cómo se muestra. */
const SCHEMAS = {
  saldos: {
    titulo: 'Saldos por cuenta', nuevo: 'Nueva cuenta',
    ayuda: 'Una fila por cuenta. El grupo decide en qué parte del panel cuenta (liquidez, colchón, inversión…).',
    cols: [
      {k: 'cuenta', l: 'Cuenta', t: 'text', req: true},
      {k: 'entidad', l: 'Entidad', t: 'text'},
      {k: 'grupo', l: 'Grupo', t: 'select', opts: GRUPOS},
      {k: 'saldo', l: 'Saldo', t: 'money'}
    ]
  },
  gastos: {
    titulo: 'Gastos', nuevo: 'Nuevo gasto',
    ayuda: 'Las devoluciones y los Bizum que te devuelven van en negativo.',
    cols: [
      {k: 'fecha', l: 'Fecha', t: 'date', req: true},
      {k: 'concepto', l: 'Concepto', t: 'text', req: true},
      {k: 'categoria', l: 'Categoría', t: 'text', list: 'categorias', req: true},
      {k: 'importe', l: 'Importe', t: 'money', req: true}
    ]
  },
  ingresos: {
    titulo: 'Nóminas', nuevo: 'Nueva nómina',
    ayuda: 'Marca «Reparto cerrado» cuando ya hayas movido el dinero de esa nómina.',
    cols: [
      {k: 'mes', l: 'Mes', t: 'month', req: true},
      {k: 'concepto', l: 'Concepto', t: 'text'},
      {k: 'importe', l: 'Importe', t: 'money', req: true},
      {k: 'cerrada', l: 'Reparto cerrado', t: 'bool'}
    ]
  },
  movimientos: {
    titulo: 'Transferencias hechas', nuevo: 'Nueva transferencia',
    ayuda: 'Dinero que mueves desde la cuenta corriente a ahorro o inversión, apuntado a la nómina que lo paga.',
    cols: [
      {k: 'fecha', l: 'Fecha', t: 'date', req: true},
      {k: 'mes_nomina', l: 'Nómina', t: 'month', req: true},
      {k: 'destino', l: 'Destino', t: 'select', opts: DESTINOS},
      {k: 'importe', l: 'Importe', t: 'money', req: true}
    ]
  },
  presupuesto: {
    titulo: 'Gastos previstos', nuevo: 'Nueva partida',
    ayuda: 'Previsto = cantidad × precio. Marca «pendiente» si aún no sabes la cifra.',
    cols: [
      {k: 'mes', l: 'Mes', t: 'month', req: true},
      {k: 'concepto', l: 'Concepto', t: 'text', list: 'categorias', req: true},
      {k: 'cantidad', l: 'Cantidad', t: 'number'},
      {k: 'unidad', l: 'Unidad', t: 'text'},
      {k: 'precio', l: 'Precio', t: 'money'},
      {k: 'pendiente', l: 'Pendiente de cifra', t: 'bool'}
    ]
  },
  cartera: {
    titulo: 'Fondos de la cartera', nuevo: 'Nuevo fondo',
    ayuda: 'Valor e invertido de cada fondo. La ganancia y la rentabilidad se calculan solas.',
    cols: [
      {k: 'fondo', l: 'Fondo', t: 'text', req: true},
      {k: 'isin', l: 'ISIN', t: 'text'},
      {k: 'tipo', l: 'Tipo', t: 'select', opts: TIPOS_FONDO},
      {k: 'participaciones', l: 'Participaciones', t: 'number'},
      {k: 'valor_liquidativo', l: 'Valor liquidativo', t: 'number'},
      {k: 'invertido', l: 'Invertido', t: 'money', req: true},
      {k: 'valor', l: 'Valor', t: 'money', req: true}
    ]
  },
  historial: {
    titulo: 'Historial de saldos', nuevo: 'Nueva foto',
    ayuda: 'Una foto de tus saldos por fecha. Se añade sola al guardar en «Saldos».',
    cols: [
      {k: 'fecha', l: 'Fecha', t: 'date', req: true},
      {k: 'corriente', l: 'Corriente', t: 'money'},
      {k: 'coche', l: 'Coche', t: 'money'},
      {k: 'emergencia', l: 'Emergencia', t: 'money'},
      {k: 'remunerada', l: 'Remunerada', t: 'money'},
      {k: 'indexada', l: 'Inversión', t: 'money'},
      {k: 'otros', l: 'Otros', t: 'money'},
      {k: 'efectivo', l: 'Efectivo', t: 'money'},
      {k: 'deudas', l: 'Deudas', t: 'money'}
    ]
  }
};

function emptyState() {
  const s = {version: 1, config: {...DEFAULT_CONFIG}};
  for (const k of Object.keys(SCHEMAS)) s[k] = [];
  return s;
}

let seq = 0;
const newId = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

/* Convierte cualquier valor importado al tipo de su columna. */
function coerce(col, v) {
  if (col.t === 'money' || col.t === 'number') {
    if (v === '' || v == null) return 0;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (col.t === 'bool') return v === true || v === 'sí' || v === 'si' || v === 'true' || v === 1 || v === '1';
  return v == null ? '' : String(v);
}

function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  s.config = {...DEFAULT_CONFIG, ...(raw.config && typeof raw.config === 'object' ? raw.config : {})};
  for (const k of ['mesesColchon', 'pctTR', 'margen', 'cuotaCoche']) s.config[k] = Number(s.config[k]) || 0;
  s.config.nombre = String(s.config.nombre || '');
  for (const [k, sch] of Object.entries(SCHEMAS)) {
    const rows = Array.isArray(raw[k]) ? raw[k] : [];
    s[k] = rows.filter((r) => r && typeof r === 'object').map((r) => {
      const o = {id: r.id ? String(r.id) : newId()};
      for (const c of sch.cols) o[c.k] = coerce(c, r[c.k]);
      return o;
    });
  }
  return s;
}

function load() {
  try {
    const txt = localStorage.getItem(KEY);
    if (txt) return normalize(JSON.parse(txt));
  } catch (e) { /* almacenamiento no disponible o datos corruptos */ }
  return emptyState();
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    toast('No se pudo guardar en este dispositivo. Exporta una copia de seguridad.');
  }
}

/* ───────────────────────── Utilidades ───────────────────────── */

const eur0 = new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});
const eur2 = new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2});
const pct0 = new Intl.NumberFormat('es-ES', {style: 'percent', maximumFractionDigits: 0});
const pct1 = new Intl.NumberFormat('es-ES', {style: 'percent', maximumFractionDigits: 1});
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const sum = (arr, f) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const signed = (v) => (v >= 0 ? '+' : '−') + eur2.format(Math.abs(v));
const mesNombre = (ym) => (ym ? MESES[Number(ym.slice(5, 7)) - 1] || ym : '—');
const toDate = (iso) => new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
const fechaCorta = (iso) => toDate(iso).toLocaleDateString('es-ES', {day: 'numeric', month: 'short', timeZone: 'UTC'});
const fechaLarga = (iso) => toDate(iso).toLocaleDateString('es-ES', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
const hoy = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const mesSiguiente = (ym) => {
  let [y, m] = ym.split('-').map(Number);
  m += 1; if (m > 12) { m = 1; y += 1; }
  return y + '-' + String(m).padStart(2, '0');
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* Crea elementos sin innerHTML: los textos nunca se interpretan como HTML. */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, text) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ───────────────────────── Cálculos ───────────────────────── */

function calcResumen(st) {
  const total = sum(st.saldos, (r) => r.saldo);
  const liquidez = sum(st.saldos.filter((r) => r.grupo === 'Liquidez' || r.grupo === 'Efectivo'), (r) => r.saldo);
  const inversion = sum(st.saldos.filter((r) => r.grupo === 'Inversión'), (r) => r.saldo);
  const fondos = sum(st.cartera, (r) => r.valor);
  const invertido = sum(st.cartera, (r) => r.invertido);
  const ganancia = fondos - invertido;
  const variable = sum(st.cartera.filter((r) => r.tipo === 'Renta variable'), (r) => r.valor);
  return {
    patrimonio: total, liquidez, inversion, fondos, invertido, ganancia,
    rentabilidad: invertido ? ganancia / invertido : 0,
    pctVariable: fondos ? variable / fondos : 0,
    pctFija: fondos ? 1 - variable / fondos : 0
  };
}

function ultimaNomina(st) {
  return st.ingresos.map((r) => r.mes).filter(Boolean).sort().pop() || null;
}

/* Gastos del mes siguiente a la última nómina: previsto (presupuesto) frente a gastado. */
function calcMesGastos(st) {
  const nom = ultimaNomina(st);
  const mes = nom ? mesSiguiente(nom) : hoy().slice(0, 7);
  const rows = st.presupuesto.filter((r) => r.mes === mes).map((r) => ({
    concepto: r.concepto, previsto: r.cantidad * r.precio, gastado: 0, pendiente: r.pendiente
  }));
  for (const g of st.gastos) {
    if (String(g.fecha).slice(0, 7) !== mes) continue;
    const r = rows.find((x) => x.concepto === g.categoria);
    if (r) r.gastado += g.importe;
    else rows.push({concepto: g.categoria, previsto: 0, gastado: g.importe, pendiente: false});
  }
  return {mes, rows, previsto: sum(rows, (r) => r.previsto), gastado: sum(rows, (r) => r.gastado)};
}

function calcColchon(st, mesGastos) {
  const gastoMes = mesGastos.previsto;
  const actual = sum(st.saldos.filter((r) => r.grupo === 'Fondo de emergencia' || r.grupo === 'Cuenta remunerada'), (r) => r.saldo);
  const objetivo = gastoMes * st.config.mesesColchon;
  return {gastoMes, actual, objetivo, meses: gastoMes ? actual / gastoMes : 0, falta: Math.max(0, objetivo - actual)};
}

/* Reparto de la última nómina: en la cuenta corriente se quedan los gastos previstos + margen;
 * lo que sobra va pctTR a la cuenta remunerada y el resto a la cartera, en decenas. */
function calcReparto(st, mesGastos) {
  const nomina = ultimaNomina(st);
  if (!nomina) return null;
  const c = st.config;
  const hechos = st.movimientos.filter((m) => m.mes_nomina === nomina);
  const hecho = (d) => sum(hechos.filter((m) => m.destino === d), (m) => m.importe);
  const movido = sum(hechos, (m) => m.importe);
  const corrienteHoy = sum(st.saldos.filter((r) => r.grupo === 'Liquidez'), (r) => r.saldo);
  const corriente = corrienteHoy + movido;
  const sobra = Math.max(0, corriente - mesGastos.previsto - c.margen);
  const tr = Math.round(sobra * c.pctTR / 10) * 10;
  const idx = Math.floor((sobra - tr) / 10) * 10;
  const fila = (destino, importe, h) => ({destino, importe, hecho: h, pendiente: Math.max(0, importe - h)});
  const cerrada = st.ingresos.some((r) => r.mes === nomina && r.cerrada);
  const [d1, d2] = DESTINOS;
  const rows = cerrada
    ? [fila(d1, hecho(d1), hecho(d1)), fila(d2, hecho(d2), hecho(d2)), {destino: 'Se queda en la cuenta corriente', importe: corrienteHoy, otra: true}]
    : [fila(d1, tr, hecho(d1)), fila(d2, idx, hecho(d2)), {destino: 'Se queda en la cuenta corriente', importe: corriente - tr - idx, otra: true}];
  return {nomina, cerrada, rows, aMover: rows[0].importe + rows[1].importe};
}

function calcGastosCat(st) {
  const mes = st.gastos.map((g) => String(g.fecha).slice(0, 7)).sort().pop();
  if (!mes) return {mes: null, rows: [], total: 0};
  const por = {};
  for (const g of st.gastos) if (String(g.fecha).slice(0, 7) === mes) por[g.categoria] = (por[g.categoria] || 0) + g.importe;
  const rows = Object.entries(por).map(([categoria, importe]) => ({categoria, importe: Math.round(importe * 100) / 100})).sort((a, b) => b.importe - a.importe);
  return {mes, rows, total: sum(rows, (r) => r.importe)};
}

const HIST_KEYS = ['corriente', 'coche', 'emergencia', 'remunerada', 'indexada', 'otros', 'efectivo'];
const totHist = (r) => sum(HIST_KEYS, (k) => r[k]) - (Number(r.deudas) || 0);
const GRUPO_A_HIST = {
  'Liquidez': 'corriente', 'Apartado para el coche': 'coche', 'Fondo de emergencia': 'emergencia',
  'Cuenta remunerada': 'remunerada', 'Inversión': 'indexada', 'Efectivo': 'efectivo'
};

/* Guarda una foto de los saldos actuales en el historial (sustituye la del mismo día). */
function fotoSaldos(fecha) {
  const foto = {id: newId(), fecha, deudas: 0};
  for (const k of HIST_KEYS) foto[k] = 0;
  for (const r of state.saldos) {
    const k = GRUPO_A_HIST[r.grupo] || 'otros';
    foto[k] = Math.round((foto[k] + r.saldo) * 100) / 100;
  }
  const i = state.historial.findIndex((r) => r.fecha === fecha);
  if (i >= 0) { foto.id = state.historial[i].id; foto.deudas = state.historial[i].deudas; state.historial[i] = foto; }
  else state.historial.push(foto);
}

/* ───────────────────────── Piezas de interfaz ───────────────────────── */

function tile(label, big, ...subs) {
  return h('div', {class: 'tile'}, h('span', {class: 'lbl'}, label), h('span', {class: 'big'}, big), subs.map((x) => (x instanceof Node ? x : h('span', {class: 'sub'}, x))));
}

function barList(items) {
  // items: [{label, extra, valor, max, color, fondo?: {valor, color}, valueText, valueClass}]
  return h('div', {class: 'bars'}, items.map((it) => {
    const track = h('span', {class: 'track'});
    if (it.fondo) track.append(h('span', {class: 'fill', style: `width:${Math.max(0, it.fondo.valor) / it.max * 100}%;background:${it.fondo.color};opacity:.45`}));
    track.append(h('span', {class: 'fill', style: `width:${Math.max(0, it.valor) / it.max * 100}%;background:${it.color}`}));
    return h('div', {class: 'bar'},
      h('span', null, it.label, it.extra ? h('span', {class: 'e ' + (it.extraClass || '')}, ' · ' + it.extra) : null),
      h('span', {class: 'v ' + (it.valueClass || '')}, it.valueText),
      track);
  }));
}

function emptyMsg(text, linkHash, linkText) {
  return h('p', {class: 'empty'}, text, linkHash ? [' ', h('a', {href: linkHash}, linkText)] : null);
}

/* ───────────────────────── Vista: Panel ───────────────────────── */

function vistaPanel() {
  const st = state;
  const res = calcResumen(st);
  const mg = calcMesGastos(st);
  const col = calcColchon(st, mg);
  const rep = calcReparto(st, mg);
  const cat = calcGastosCat(st);
  const out = [];

  if (!st.saldos.length && !st.gastos.length) {
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Empieza aquí'),
      h('p', {class: 'note'}, 'Todavía no hay datos. Puedes importar tu copia de seguridad (archivo .json) o empezar añadiendo tus cuentas en «Saldos».'),
      h('div', {class: 'btns'},
        h('a', {class: 'btn pri', href: '#datos'}, 'Importar datos'),
        h('a', {class: 'btn', href: '#saldos'}, 'Añadir cuentas'))));
  }

  out.push(h('p', {class: 'intro'},
    'Tienes ', h('b', null, eur0.format(res.patrimonio)), ' en total.',
    rep && !rep.cerrada ? [' Con la nómina de ', mesNombre(rep.nomina), ' puedes mover ', h('b', null, eur0.format(rep.aMover)), ' a ahorro e inversión.'] : null));

  // Delta respecto a la foto anterior
  const hist = st.historial.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  let delta = h('span', {class: 'sub'}, hist.length ? 'Primer registro: ' + fechaCorta(hist[0].fecha) : 'Guarda tus saldos para ver la evolución');
  if (hist.length >= 2) {
    const d = totHist(hist[hist.length - 1]) - totHist(hist[hist.length - 2]);
    delta = h('span', {class: 'sub ' + (d >= 0 ? 'ok' : 'bad')}, signed(d) + ' desde el ' + fechaCorta(hist[hist.length - 2].fecha));
  }

  const cuenta = (grupo) => st.saldos.filter((r) => r.grupo === grupo);
  const tiles = [
    tile('Patrimonio neto', eur2.format(res.patrimonio), delta),
    tile('Dinero disponible', eur2.format(res.liquidez), 'Cuenta corriente y efectivo: lo demás no lo tocas')
  ];
  const rem = cuenta('Cuenta remunerada');
  if (rem.length) tiles.push(tile(rem.map((r) => r.entidad || r.cuenta).join(' + '), eur2.format(sum(rem, (r) => r.saldo)), 'Cuenta remunerada'));
  const efe = cuenta('Efectivo');
  if (efe.length) tiles.push(tile('Efectivo en casa', eur2.format(sum(efe, (r) => r.saldo)), 'Cuenta como disponible'));
  if (res.inversion || st.cartera.length) {
    tiles.push(tile('Inversión', eur2.format(res.inversion),
      st.cartera.length ? eur2.format(res.fondos) + ' en fondos' : 'Añade tus fondos en «Cartera»',
      st.cartera.length ? h('span', {class: 'sub'}, h('span', {class: res.ganancia >= 0 ? 'ok' : 'bad'}, signed(res.ganancia)), ' (' + (res.rentabilidad >= 0 ? '+' : '') + pct1.format(res.rentabilidad) + ') sobre ' + eur2.format(res.invertido) + ' aportados') : null));
  }
  tiles.push(tile('Colchón · emergencia + remunerada',
    col.gastoMes ? col.meses.toLocaleString('es-ES', {maximumFractionDigits: 1}) + ' meses' : '—',
    col.gastoMes
      ? h('span', {class: 'sub'}, 'Objetivo ' + st.config.mesesColchon + ' meses: ', h('span', {class: col.falta > 0 ? 'warn' : 'ok'}, col.falta > 0 ? 'faltan ' + eur0.format(col.falta) : 'completo'))
      : 'Añade gastos previstos para calcularlo'));
  out.push(h('section', {class: 'tiles'}, tiles));

  // Reparto + dónde está el dinero
  const grid1 = h('div', {class: 'grid'});
  if (rep) {
    const colores = [css('--c2'), css('--c0'), css('--muted-bar')];
    const tb = h('tbody', null, rep.rows.map((x, i) => h('tr', null,
      h('td', null, h('span', {class: 'dot', style: 'background:' + colores[i]}), x.destino),
      h('td', null, eur2.format(x.importe)),
      x.otra ? [h('td', null, '·'), h('td', null, '·')]
        : [h('td', {class: x.hecho > 0 ? 'ok' : ''}, eur2.format(x.hecho)), h('td', {class: x.pendiente > 0 ? 'warn' : 'ok'}, x.pendiente > 0 ? eur2.format(x.pendiente) : 'Hecho')])));
    const c = st.config;
    const coche = cuenta('Apartado para el coche');
    grid1.append(h('section', {class: 'card'},
      h('h2', null, 'Qué hacer con la nómina de ' + mesNombre(rep.nomina)),
      h('p', {class: 'note'}, 'En la cuenta corriente se quedan los gastos previstos de ' + mesNombre(mg.mes) + ' más ' + eur0.format(c.margen) + ' de margen. Lo que sobra va ' + pct0.format(c.pctTR) + ' a la cuenta remunerada y ' + pct0.format(1 - c.pctTR) + ' a la cartera, en decenas.' + (rep.cerrada ? ' Esta nómina ya está cerrada: ves lo que moviste.' : '')),
      h('div', {class: 'tw'}, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Destino'), h('th', null, 'Importe'), h('th', null, 'Hecho'), h('th', null, 'Pendiente'))), tb)),
      c.cuotaCoche > 0 && coche.length
        ? h('p', {class: 'note'}, 'La cuota del coche (' + eur2.format(c.cuotaCoche) + ' al mes) no cuenta como gasto: la cubre la cuenta del coche, que da para ', h('b', null, String(Math.floor(sum(coche, (r) => r.saldo) / c.cuotaCoche))), ' cuotas.')
        : null,
      h('div', {class: 'btns'}, h('button', {class: 'btn sm', type: 'button', onclick: () => editRow('movimientos', null, {fecha: hoy(), mes_nomina: rep.nomina, destino: DESTINOS[0]})}, 'Apuntar transferencia'))));
  } else {
    grid1.append(h('section', {class: 'card'}, h('h2', null, 'Reparto de la nómina'), emptyMsg('Apunta tu nómina para ver cuánto mover a ahorro e inversión.', '#nominas', 'Ir a nóminas')));
  }

  const saldosOrd = st.saldos.slice().sort((a, b) => b.saldo - a.saldo);
  const maxS = Math.max(1, ...saldosOrd.map((r) => r.saldo));
  const colGrupo = {'Fondo de emergencia': css('--c1'), 'Cuenta remunerada': css('--c2'), 'Inversión': css('--c0')};
  grid1.append(h('section', {class: 'card'},
    h('h2', null, 'Dónde está tu dinero'),
    hist.length ? h('p', {class: 'note'}, 'Última foto de saldos: ' + fechaLarga(hist[hist.length - 1].fecha)) : null,
    saldosOrd.length
      ? barList(saldosOrd.map((r) => ({label: r.cuenta, extra: r.entidad, valor: r.saldo, max: maxS, color: colGrupo[r.grupo] || css('--muted-bar'), valueText: eur2.format(r.saldo)})))
      : emptyMsg('Sin cuentas todavía.', '#saldos', 'Añadir cuentas')));
  out.push(grid1);

  // Gastos del mes: previsto vs gastado + últimos gastos
  const grid2 = h('div', {class: 'grid'});
  const maxG = Math.max(1, ...mg.rows.map((x) => Math.max(x.previsto, x.gastado)));
  grid2.append(h('section', {class: 'card'},
    h('h2', null, 'Gastos de ' + mesNombre(mg.mes) + ': previsto y gastado'),
    h('p', {class: 'note'}, 'Previsto: ', h('b', null, eur0.format(mg.previsto)), '. Gastado hasta ahora: ', h('b', null, eur0.format(mg.gastado)), '.'),
    mg.rows.length
      ? barList(mg.rows.map((x) => ({
        label: x.concepto, extra: x.pendiente ? 'pendiente de cifra' : null, extraClass: 'warn',
        valor: x.gastado, max: maxG, color: x.gastado > x.previsto ? css('--bad') : css('--c0'),
        fondo: {valor: x.previsto, color: css('--muted-bar')},
        valueText: eur0.format(x.gastado) + ' de ' + eur0.format(x.previsto),
        valueClass: x.gastado > x.previsto && x.previsto > 0 ? 'bad' : ''
      })))
      : emptyMsg('No hay gastos previstos para ' + mesNombre(mg.mes) + '.', '#presupuesto', 'Añadir presupuesto')));

  const ult = st.gastos.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 8);
  grid2.append(h('section', {class: 'card'},
    h('h2', null, 'Últimos gastos'),
    ult.length
      ? h('div', {class: 'tw'}, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Fecha'), h('th', null, 'Concepto'), h('th', null, 'Importe'))),
        h('tbody', null, ult.map((g) => h('tr', null, h('td', null, fechaCorta(g.fecha)), h('td', {style: 'text-align:left'}, g.concepto), h('td', {class: g.importe < 0 ? 'ok' : ''}, eur2.format(g.importe)))))))
      : emptyMsg('Todavía no hay gastos apuntados.'),
    h('div', {class: 'btns'}, h('a', {class: 'btn sm', href: '#gastos'}, st.gastos.length ? 'Ver los ' + st.gastos.length + ' gastos' : 'Apuntar un gasto'))));
  out.push(grid2);

  // Gastos reales por categoría
  if (cat.rows.length) {
    const maxC = Math.max(1, ...cat.rows.map((x) => x.importe));
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Gastos reales de ' + mesNombre(cat.mes) + ' por categoría'),
      h('p', {class: 'note'}, 'Total: ', h('b', null, eur2.format(cat.total)), '. Las devoluciones y los Bizum que te devuelven restan.'),
      barList(cat.rows.map((x) => ({label: x.categoria, valor: x.importe, max: maxC, color: css('--c0'), valueText: eur2.format(x.importe), valueClass: x.importe < 0 ? 'ok' : ''})))));
  }

  // Cartera
  if (st.cartera.length) out.push(carteraCard(res));

  // Evolución
  out.push(h('section', {class: 'card'},
    h('h2', null, 'Evolución del patrimonio'),
    h('p', {class: 'note'}, 'Un punto cada vez que guardas tus saldos.'),
    hist.length ? chartEvolucion(hist) : emptyMsg('Aún no hay fotos de saldos.', '#saldos', 'Guardar saldos')));

  return out;
}

function carteraCard(res) {
  const st = state;
  const mix = h('div', {class: 'mix'});
  const tot = res.fondos || 1;
  [['Renta variable', css('--c0')], ['Renta fija', css('--c3')]].forEach(([t, c]) => {
    const v = sum(st.cartera.filter((r) => r.tipo === t), (r) => r.valor);
    mix.append(h('span', {style: `width:${v / tot * 100}%;background:${c}`}));
  });
  const rows = st.cartera.slice().sort((a, b) => b.valor - a.valor);
  return h('section', {class: 'card'},
    h('h2', null, 'Cartera por fondo'),
    h('p', {class: 'note'}, h('span', {class: 'dot', style: 'background:' + css('--c0')}), 'Renta variable ', h('b', null, pct0.format(res.pctVariable)), ' · ', h('span', {class: 'dot', style: 'background:' + css('--c3')}), 'renta fija ', h('b', null, pct0.format(res.pctFija)), '. Ganancia desde que compraste cada fondo.'),
    mix,
    h('div', {class: 'tw'}, h('table', null,
      h('thead', null, h('tr', null, h('th', null, 'Fondo'), h('th', null, 'Tipo'), h('th', null, 'Valor'), h('th', null, 'Ganancia'), h('th', null, 'Rentab.'))),
      h('tbody', null, rows.map((x) => {
        const g = x.valor - x.invertido, p = x.invertido ? g / x.invertido : 0, cls = g >= 0 ? 'ok' : 'bad';
        return h('tr', null, h('td', null, x.fondo), h('td', null, x.tipo), h('td', null, eur2.format(x.valor)), h('td', {class: cls}, signed(g)), h('td', {class: cls}, (p >= 0 ? '+' : '') + pct1.format(p)));
      })))));
}

function chartEvolucion(hist) {
  const wrap = h('div', {class: 'chart'});
  const keys = [
    ['corriente', 'Corriente, coche y efectivo', css('--muted-bar'), (r) => r.corriente + r.coche + r.efectivo],
    ['emergencia', 'Fondo de emergencia', css('--c1'), (r) => r.emergencia],
    ['remunerada', 'Cuenta remunerada', css('--c2'), (r) => r.remunerada],
    ['indexada', 'Inversión y otros', css('--c0'), (r) => r.indexada + r.otros]
  ];
  const rows = hist.slice(-24);
  const tot = (r) => sum(keys, ([, , , f]) => f(r));
  // Ancho real disponible (vista menos el relleno de la tarjeta) para que el texto no se escale.
  const W = Math.max(280, (document.getElementById('vista').clientWidth || 640) - 66), H = 240, m = {t: 24, r: 8, b: 26, l: 64};
  const maxV = Math.max(1, ...rows.map(tot)) * 1.1;
  // Escala con marcas "redondas"
  const step = Math.pow(10, Math.floor(Math.log10(maxV / 4)));
  const nice = [1, 2, 2.5, 5, 10].map((k) => k * step).find((k) => maxV / k <= 5) || step * 10;
  const top = Math.ceil(maxV / nice) * nice;
  const y = (v) => H - m.b - v / top * (H - m.t - m.b);
  const svg = s('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Evolución del patrimonio'});
  for (let v = 0; v <= top + 1e-9; v += nice) {
    svg.append(s('line', {x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: css('--grid')}));
    svg.append(s('text', {x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end'}, eur0.format(v)));
  }
  const band = (W - m.l - m.r) / rows.length;
  const bw = Math.min(36, band * 0.6);
  const tip = h('div', {class: 'tip', hidden: true});
  rows.forEach((r, i) => {
    const cx = m.l + band * i + band / 2;
    const g = s('g', {style: 'cursor:default'});
    let acc = 0;
    for (const [, , color, f] of keys) {
      const v = f(r);
      if (v <= 0) continue;
      g.append(s('rect', {x: cx - bw / 2, width: bw, y: y(acc + v), height: y(acc) - y(acc + v), fill: color}));
      acc += v;
    }
    g.append(s('rect', {x: m.l + band * i, width: band, y: m.t, height: H - m.t - m.b, fill: 'transparent'}));
    svg.append(g);
    svg.append(s('text', {x: cx, y: y(acc) - 6, 'text-anchor': 'middle', class: 'tot'}, eur0.format(totHist(r))));
    if (rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0) svg.append(s('text', {x: cx, y: H - 8, 'text-anchor': 'middle'}, fechaCorta(r.fecha)));
    g.addEventListener('pointermove', (ev) => {
      tip.replaceChildren(h('div', {class: 'sub'}, fechaLarga(r.fecha)), keys.map(([, t, color, f]) => h('div', null, h('span', {class: 'dot', style: 'background:' + color}), t + ': ' + eur0.format(f(r)))));
      tip.hidden = false;
      const box = wrap.getBoundingClientRect();
      const px = ev.clientX - box.left, py = ev.clientY - box.top;
      tip.style.left = Math.min(Math.max(0, px + 12), box.width - tip.offsetWidth) + 'px';
      tip.style.top = Math.max(0, py - 10) + 'px';
    });
    g.addEventListener('pointerleave', () => { tip.hidden = true; });
  });
  wrap.append(svg, tip);
  return wrap;
}

/* ───────────────────────── Edición genérica de tablas ───────────────────────── */

function fmtCell(col, v) {
  if (col.t === 'money') return eur2.format(v);
  if (col.t === 'number') return Number(v).toLocaleString('es-ES', {maximumFractionDigits: 4});
  if (col.t === 'bool') return v ? 'Sí' : 'No';
  if (col.t === 'date') return v ? fechaCorta(v) : '';
  if (col.t === 'month') return v ? mesNombre(v) + ' ' + v.slice(0, 4) : '';
  return v;
}

function categorias() {
  const set = new Set();
  state.presupuesto.forEach((r) => r.concepto && set.add(r.concepto));
  state.gastos.forEach((r) => r.categoria && set.add(r.categoria));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

function campo(col, valor) {
  const id = 'f-' + col.k;
  if (col.t === 'bool') return h('label', {class: 'chk'}, h('input', {type: 'checkbox', name: col.k, id, checked: !!valor}), col.l);
  let input;
  if (col.t === 'select') {
    const opts = col.opts.includes(valor) || !valor ? col.opts : [valor, ...col.opts];
    input = h('select', {name: col.k, id}, opts.map((o) => h('option', {value: o, selected: o === valor}, o)));
  } else {
    const type = {money: 'number', number: 'number', date: 'date', month: 'month'}[col.t] || 'text';
    input = h('input', {
      type, name: col.k, id, value: valor == null ? '' : String(valor),
      step: col.t === 'money' ? '0.01' : col.t === 'number' ? 'any' : null,
      inputmode: col.t === 'money' || col.t === 'number' ? 'decimal' : null,
      list: col.list ? 'dl-' + col.list : null,
      required: !!col.req, autocomplete: 'off'
    });
  }
  return h('label', {class: 'f'}, col.l, input);
}

function leerForm(form, cols) {
  const o = {};
  for (const c of cols) {
    const el = form.elements[c.k];
    o[c.k] = coerce(c, c.t === 'bool' ? el.checked : el.value);
  }
  return o;
}

function datalists() {
  return h('datalist', {id: 'dl-categorias'}, categorias().map((c) => h('option', {value: c})));
}

/* Abre el diálogo para crear (id null) o editar una fila. */
function editRow(tabla, id, inicial) {
  const sch = SCHEMAS[tabla];
  const fila = id ? state[tabla].find((r) => r.id === id) : null;
  const datos = fila || inicial || {};
  const dlg = document.getElementById('dialogo');
  const form = document.getElementById('dialogo-form');
  form.replaceChildren(
    h('h3', null, fila ? 'Editar' : sch.nuevo),
    sch.ayuda ? h('p', {class: 'note'}, sch.ayuda) : null,
    datalists(),
    h('div', {class: 'form'}, h('div', {class: 'row'}, sch.cols.map((c) => campo(c, datos[c.k])))),
    h('div', {class: 'btns', style: 'margin-top:14px;justify-content:flex-end'},
      fila ? h('button', {class: 'btn dan', type: 'button', onclick: () => { borrar(tabla, id); dlg.close(); }}, 'Borrar') : null,
      h('button', {class: 'btn', type: 'button', onclick: () => dlg.close()}, 'Cancelar'),
      h('button', {class: 'btn pri', type: 'submit', value: 'ok'}, 'Guardar')));
  form.onsubmit = (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const o = leerForm(form, sch.cols);
    if (fila) Object.assign(fila, o);
    else state[tabla].push({id: newId(), ...o});
    save();
    dlg.close();
    render();
    toast('Guardado');
  };
  dlg.showModal();
}

function borrar(tabla, id) {
  if (!confirm('¿Borrar esta fila?')) return;
  state[tabla] = state[tabla].filter((r) => r.id !== id);
  save();
  render();
  toast('Borrado');
}

/* Tabla con todas las filas y botones de editar. */
function tablaEditable(tabla, {orden, limite, cols} = {}) {
  const sch = SCHEMAS[tabla];
  const visibles = cols ? sch.cols.filter((c) => cols.includes(c.k)) : sch.cols;
  let rows = state[tabla].slice();
  if (orden) rows.sort(orden);
  const total = rows.length;
  if (limite) rows = rows.slice(0, limite);
  return h('section', {class: 'card'},
    h('h2', null, sch.titulo),
    sch.ayuda ? h('p', {class: 'note'}, sch.ayuda) : null,
    total
      ? h('div', {class: 'tw'}, h('table', null,
        h('thead', null, h('tr', null, visibles.map((c) => h('th', null, c.l)), h('th', null, ''))),
        h('tbody', null, rows.map((r) => h('tr', null,
          visibles.map((c) => h('td', {class: c.t === 'money' && r[c.k] < 0 ? 'ok' : ''}, fmtCell(c, r[c.k]))),
          h('td', {class: 'acc'}, h('button', {class: 'icon-btn', type: 'button', 'aria-label': 'Editar', onclick: () => editRow(tabla, r.id)}, '✎')))))))
      : h('p', {class: 'empty'}, 'Sin filas todavía.'),
    limite && total > limite ? h('p', {class: 'note'}, 'Mostrando ' + limite + ' de ' + total + '.') : null,
    h('div', {class: 'btns'}, h('button', {class: 'btn', type: 'button', onclick: () => editRow(tabla, null)}, '+ ' + sch.nuevo)));
}

/* ───────────────────────── Vistas de edición ───────────────────────── */

function vistaGastos() {
  const cols = SCHEMAS.gastos.cols;
  const form = h('form', {class: 'form'},
    datalists(),
    h('div', {class: 'row'}, cols.map((c) => campo(c, c.k === 'fecha' ? hoy() : ''))),
    h('div', {class: 'btns'}, h('button', {class: 'btn pri', type: 'submit'}, 'Apuntar gasto')));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    state.gastos.push({id: newId(), ...leerForm(form, cols)});
    save();
    toast('Gasto apuntado');
    render();
    const c = document.getElementById('f-concepto');
    if (c) c.focus();
  });
  const mes = state.gastos.length ? calcGastosCat(state) : null;
  return [
    h('section', {class: 'card'}, h('h2', null, 'Apuntar un gasto'), h('p', {class: 'note'}, SCHEMAS.gastos.ayuda), form),
    mes && mes.mes ? h('p', {class: 'intro'}, 'Gastado en ' + mesNombre(mes.mes) + ': ', h('b', null, eur2.format(mes.total)), '.') : null,
    tablaEditable('gastos', {orden: (a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0), limite: 200})
  ];
}

function vistaSaldos() {
  const filas = state.saldos.map((r) => h('div', {class: 'saldo-row'},
    h('div', null, h('div', null, r.cuenta), h('div', {class: 'e'}, [r.entidad, r.grupo].filter(Boolean).join(' · '))),
    h('input', {type: 'number', step: '0.01', inputmode: 'decimal', value: String(r.saldo), 'data-id': r.id, 'aria-label': 'Saldo de ' + r.cuenta})));
  const fecha = h('input', {type: 'date', value: hoy(), id: 'f-foto'});
  const guardar = () => {
    document.querySelectorAll('.saldo-row input[data-id]').forEach((inp) => {
      const r = state.saldos.find((x) => x.id === inp.dataset.id);
      if (r) r.saldo = coerce({t: 'money'}, inp.value);
    });
    if (fecha.value) fotoSaldos(fecha.value);
    save();
    render();
    toast('Saldos guardados y añadidos al historial');
  };
  return [
    h('section', {class: 'card'},
      h('h2', null, 'Actualizar saldos'),
      h('p', {class: 'note'}, 'Escribe lo que hay hoy en cada cuenta y guarda: se añade un punto a la evolución del patrimonio.'),
      state.saldos.length ? filas : h('p', {class: 'empty'}, 'Añade tus cuentas abajo.'),
      state.saldos.length ? h('div', {class: 'form', style: 'margin-top:8px'},
        h('label', {class: 'f', for: 'f-foto'}, 'Fecha de la foto', fecha),
        h('div', {class: 'btns'}, h('button', {class: 'btn pri', type: 'button', onclick: guardar}, 'Guardar saldos'))) : null),
    tablaEditable('saldos')
  ];
}

function vistaCartera() {
  const res = calcResumen(state);
  return [
    state.cartera.length ? h('section', {class: 'tiles'},
      tile('Valor de los fondos', eur2.format(res.fondos)),
      tile('Aportado', eur2.format(res.invertido)),
      tile('Ganancia', h('span', {class: res.ganancia >= 0 ? 'ok' : 'bad'}, signed(res.ganancia)), (res.rentabilidad >= 0 ? '+' : '') + pct1.format(res.rentabilidad))) : null,
    state.cartera.length ? carteraCard(res) : null,
    tablaEditable('cartera', {orden: (a, b) => b.valor - a.valor, cols: ['fondo', 'tipo', 'invertido', 'valor']}),
    h('p', {class: 'note'}, 'Recuerda actualizar también el saldo de tu cuenta de inversión en «Saldos» para que cuente en el patrimonio.')
  ];
}

function vistaMas() {
  const items = [
    ['#nominas', 'Nóminas y transferencias', 'Lo que cobras y lo que mueves a ahorro e inversión'],
    ['#presupuesto', 'Gastos previstos', 'Presupuesto por mes y categoría'],
    ['#historial', 'Historial de saldos', 'Las fotos de la evolución del patrimonio'],
    ['#ajustes', 'Reglas de reparto', 'Margen, porcentajes, colchón y cuota del coche'],
    ['#datos', 'Copia de seguridad', 'Exportar, importar o borrar tus datos']
  ];
  return [h('nav', {class: 'links'}, items.map(([href, t, d]) => h('a', {href}, t, h('span', null, d))))];
}

const volver = () => h('a', {class: 'back', href: '#mas'}, '← Más');

function vistaNominas() {
  return [volver(),
    tablaEditable('ingresos', {orden: (a, b) => (a.mes < b.mes ? 1 : -1)}),
    tablaEditable('movimientos', {orden: (a, b) => (a.fecha < b.fecha ? 1 : -1)})];
}
function vistaPresupuesto() {
  return [volver(), tablaEditable('presupuesto', {orden: (a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0)})];
}
function vistaHistorial() {
  return [volver(), tablaEditable('historial', {orden: (a, b) => (a.fecha < b.fecha ? 1 : -1)})];
}

function vistaAjustes() {
  const c = state.config;
  const f = (k, l, attrs) => h('label', {class: 'f', for: 'c-' + k}, l, h('input', {id: 'c-' + k, name: k, value: String(c[k]), ...attrs}));
  const form = h('form', {class: 'form'},
    h('div', {class: 'row'},
      f('nombre', 'Tu nombre (título de la app)', {type: 'text', autocomplete: 'off'}),
      f('margen', 'Margen en la cuenta corriente (€)', {type: 'number', step: '1', inputmode: 'decimal'}),
      h('label', {class: 'f', for: 'c-pctTR'}, '% de lo que sobra a la cuenta remunerada',
        h('input', {id: 'c-pctTR', name: 'pctTR', type: 'number', step: '1', min: '0', max: '100', value: String(Math.round(c.pctTR * 100))})),
      f('mesesColchon', 'Meses de colchón objetivo', {type: 'number', step: '1', min: '0'}),
      f('cuotaCoche', 'Cuota mensual del coche (€, 0 = ninguna)', {type: 'number', step: '0.01', inputmode: 'decimal'})),
    h('div', {class: 'btns'}, h('button', {class: 'btn pri', type: 'submit'}, 'Guardar reglas')));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e = form.elements;
    state.config = {
      nombre: e.nombre.value.trim(),
      margen: Number(e.margen.value) || 0,
      pctTR: Math.min(100, Math.max(0, Number(e.pctTR.value) || 0)) / 100,
      mesesColchon: Number(e.mesesColchon.value) || 0,
      cuotaCoche: Number(e.cuotaCoche.value) || 0
    };
    save();
    render();
    toast('Reglas guardadas');
  });
  return [volver(), h('section', {class: 'card'}, h('h2', null, 'Reglas de reparto'), h('p', {class: 'note'}, 'Con la última nómina: en la cuenta corriente se quedan los gastos previstos del mes siguiente más el margen; lo que sobra se reparte entre la cuenta remunerada y la cartera, en decenas.'), form)];
}

function vistaDatos() {
  const file = h('input', {type: 'file', accept: 'application/json,.json', hidden: true});
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const nuevo = normalize(raw);
      const n = Object.keys(SCHEMAS).reduce((t, k) => t + nuevo[k].length, 0);
      if (!n) { toast('El archivo no tiene datos reconocibles'); return; }
      if (!confirm('Se sustituirán los datos de este dispositivo por los del archivo (' + n + ' filas). ¿Seguir?')) return;
      state = nuevo;
      save();
      location.hash = '#panel';
      render();
      toast('Datos importados');
    } catch (e) {
      toast('No se pudo leer el archivo: ¿es un .json de esta app?');
    } finally {
      file.value = '';
    }
  });
  const exportar = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'});
    const a = h('a', {href: URL.createObjectURL(blob), download: 'patrimonio-' + hoy() + '.json'});
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  const borrarTodo = () => {
    if (!confirm('¿Borrar TODOS los datos de este dispositivo? Exporta antes una copia si la quieres conservar.')) return;
    state = emptyState();
    save();
    render();
    toast('Datos borrados');
  };
  return [volver(), h('section', {class: 'card'},
    h('h2', null, 'Copia de seguridad'),
    h('p', {class: 'note'}, 'Tus datos solo están en este dispositivo y navegador: no se suben a ningún sitio. Exporta una copia de vez en cuando y guárdala (por ejemplo en iCloud o Google Drive). Para pasar los datos a otro móvil, exporta aquí e importa allí.'),
    h('div', {class: 'btns'},
      h('button', {class: 'btn pri', type: 'button', onclick: exportar}, 'Exportar (.json)'),
      h('button', {class: 'btn', type: 'button', onclick: () => file.click()}, 'Importar…'),
      h('button', {class: 'btn dan', type: 'button', onclick: borrarTodo}, 'Borrar todo')),
    file)];
}

/* ───────────────────────── Navegación ───────────────────────── */

const VISTAS = {
  panel: [vistaPanel, 'panel'],
  gastos: [vistaGastos, 'gastos'],
  saldos: [vistaSaldos, 'saldos'],
  cartera: [vistaCartera, 'cartera'],
  mas: [vistaMas, 'mas'],
  nominas: [vistaNominas, 'mas'],
  presupuesto: [vistaPresupuesto, 'mas'],
  historial: [vistaHistorial, 'mas'],
  ajustes: [vistaAjustes, 'mas'],
  datos: [vistaDatos, 'mas']
};

let ultimaVista = null;
function render() {
  const nombre = (location.hash || '#panel').slice(1);
  const [fn, tab] = VISTAS[nombre] || VISTAS.panel;
  const titulo = state.config.nombre ? 'Finanzas de ' + state.config.nombre : 'Mi Patrimonio';
  document.getElementById('titulo').textContent = titulo;
  document.title = titulo;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const vista = document.getElementById('vista');
  vista.replaceChildren(...fn().flat().filter(Boolean));
  if (ultimaVista !== nombre) { window.scrollTo(0, 0); ultimaVista = nombre; }
}

window.addEventListener('hashchange', render);
let anchoPrevio = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - anchoPrevio) > 40) { anchoPrevio = window.innerWidth; render(); } });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
/* Si otra pestaña cambia los datos, recargarlos. */
window.addEventListener('storage', (e) => { if (e.key === KEY) { state = load(); render(); } });

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

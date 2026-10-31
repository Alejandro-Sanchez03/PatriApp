/* PatriApp — app de seguimiento de patrimonio.
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
  cuotaCoche: 0,     // € al mes de la cuota del coche (0 = no mostrar)
  interesTR: 0,      // % TAE de la cuenta remunerada (0 = no mostrar intereses)
  preciosAuto: true, // al abrir, aplicar los precios de precios.json del repositorio
  fuentePrecios: ''  // dirección de precios.json ('' = la del propio repositorio de GitHub)
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
      {k: 'moneda', l: 'Moneda', t: 'select', opts: ['EUR', 'USD']},
      {k: 'fecha_vl', l: 'Fecha del precio', t: 'date'},
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
  for (const k of ['mesesColchon', 'pctTR', 'margen', 'cuotaCoche', 'interesTR']) s.config[k] = Number(s.config[k]) || 0;
  s.config.nombre = String(s.config.nombre || '');
  s.config.preciosAuto = s.config.preciosAuto !== false;
  s.config.fuentePrecios = String(s.config.fuentePrecios || '');
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

/* Datos guardados solo en este dispositivo (modo sin cuenta, o versión antigua de la app). */
function loadLocal() {
  try {
    const txt = localStorage.getItem(KEY);
    if (txt) return normalize(JSON.parse(txt));
  } catch (e) { /* almacenamiento no disponible o datos corruptos */ }
  return emptyState();
}
function saveLocal(st) {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch (e) {
    toast('No se pudo guardar en este dispositivo. Exporta una copia de seguridad.');
  }
}
const totalFilas = (st) => Object.keys(SCHEMAS).reduce((t, k) => t + st[k].length, 0);

let state = emptyState();

/* cuenta.js decide dónde se guarda: en tu cuenta (Supabase) o solo en este dispositivo. */
let persistir = saveLocal;
function save() { persistir(state); }

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
  return calcGastosMes(st, nom ? mesSiguiente(nom) : hoy().slice(0, 7));
}

/* Previsto (presupuesto) frente a gastado en un mes concreto, por categoría. */
function calcGastosMes(st, mes) {
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
  const out = [];

  if (!st.saldos.length && !st.gastos.length) {
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Empieza aquí'),
      h('p', {class: 'note'}, 'Todavía no hay datos. Puedes importar tu copia de seguridad (archivo .json) o empezar añadiendo tus cuentas en «Saldos».'),
      h('div', {class: 'btns'},
        h('a', {class: 'btn pri', href: '#datos'}, 'Importar datos'),
        h('a', {class: 'btn', href: '#saldos'}, 'Añadir cuentas'))));
  }

  // Variación respecto a la foto anterior de saldos
  const hist = st.historial.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  let delta = h('span', {class: 'heroe-sub'}, hist.length ? 'Primer registro: ' + fechaCorta(hist[0].fecha) : 'Guarda tus saldos para ver cómo cambia');
  if (hist.length >= 2) {
    const d = totHist(hist[hist.length - 1]) - totHist(hist[hist.length - 2]);
    delta = h('span', {class: 'heroe-sub'}, h('span', {class: d >= 0 ? 'ok' : 'bad'}, signed(d)), ' desde el ' + fechaCorta(hist[hist.length - 2].fecha));
  }

  // Lo principal, en grande
  const mini = (label, valor, href) => h('a', {class: 'mini', href}, h('span', {class: 'lbl'}, label), h('span', {class: 'mini-num'}, valor));
  out.push(h('section', {class: 'heroe', 'aria-label': 'Patrimonio neto'},
    h('span', {class: 'heroe-lbl'}, 'Patrimonio neto'),
    h('span', {class: 'heroe-num'}, eur2.format(res.patrimonio)),
    delta,
    h('div', {class: 'mini-fila'},
      mini('Disponible', eur0.format(res.liquidez), '#saldos'),
      mini('Inversión', eur0.format(res.inversion + sum(st.saldos.filter((r) => r.grupo === 'Cuenta remunerada'), (r) => r.saldo)), '#inversion'),
      mini('Colchón', col.gastoMes ? col.meses.toLocaleString('es-ES', {maximumFractionDigits: 1}) + ' meses' : '—', '#saldos'))));

  // Gastos de este mes, en corto
  const mesHoy = hoy().slice(0, 7);
  const gm = calcGastosMes(st, mesHoy);
  out.push(h('a', {class: 'card card-enlace', href: '#gastos'},
    h('div', {class: 'fila-sep'}, h('h2', null, 'Gastos de ' + mesNombre(mesHoy)), h('span', {class: 'flecha', 'aria-hidden': 'true'}, '›')),
    h('div', {class: 'fila-sep'},
      h('span', {class: 'big'}, eur0.format(gm.gastado)),
      gm.previsto ? h('span', {class: 'sub'}, 'de ' + eur0.format(gm.previsto) + ' previstos') : null),
    gm.previsto ? h('span', {class: 'track'}, h('span', {class: 'fill', style: `width:${Math.min(100, Math.max(0, gm.gastado) / gm.previsto * 100)}%;background:${gm.gastado > gm.previsto ? css('--bad') : css('--accent')}`})) : null));

  // Reparto de la nómina
  if (rep) {
    const colores = [css('--c2'), css('--c0'), css('--muted-bar')];
    const c = st.config;
    const coche = st.saldos.filter((r) => r.grupo === 'Apartado para el coche');
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Qué hacer con la nómina de ' + mesNombre(rep.nomina)),
      h('p', {class: 'note'}, 'En la cuenta corriente se quedan los gastos previstos de ' + mesNombre(mg.mes) + ' más ' + eur0.format(c.margen) + ' de margen. Lo que sobra va ' + pct0.format(c.pctTR) + ' a la cuenta remunerada y ' + pct0.format(1 - c.pctTR) + ' a la cartera, en decenas.' + (rep.cerrada ? ' Esta nómina ya está cerrada: ves lo que moviste.' : '')),
      h('div', {class: 'tw'}, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Destino'), h('th', null, 'Importe'), h('th', null, 'Pendiente'))),
        h('tbody', null, rep.rows.map((x, i) => h('tr', null,
          h('td', null, h('span', {class: 'dot', style: 'background:' + colores[i]}), x.destino),
          h('td', null, eur2.format(x.importe)),
          x.otra ? h('td', null, '·') : h('td', {class: x.pendiente > 0 ? 'warn' : 'ok'}, x.pendiente > 0 ? eur2.format(x.pendiente) : 'Hecho')))))),
      c.cuotaCoche > 0 && coche.length
        ? h('p', {class: 'note'}, 'La cuota del coche (' + eur2.format(c.cuotaCoche) + ' al mes) la cubre la cuenta del coche, que da para ', h('b', null, String(Math.floor(sum(coche, (r) => r.saldo) / c.cuotaCoche))), ' cuotas.')
        : null,
      h('div', {class: 'btns'},
        h('button', {class: 'btn sm', type: 'button', onclick: () => editRow('movimientos', null, {fecha: hoy(), mes_nomina: rep.nomina, destino: DESTINOS[0]})}, 'Apuntar transferencia'),
        h('a', {class: 'btn sm', href: '#nominas'}, 'Nóminas'))));
  }

  // Dónde está el dinero
  const saldosOrd = st.saldos.slice().sort((a, b) => b.saldo - a.saldo);
  const maxS = Math.max(1, ...saldosOrd.map((r) => r.saldo));
  const colGrupo = {'Fondo de emergencia': css('--c1'), 'Cuenta remunerada': css('--c2'), 'Inversión': css('--c0')};
  if (saldosOrd.length) {
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Dónde está tu dinero'),
      hist.length ? h('p', {class: 'note'}, 'Última actualización: ' + fechaLarga(hist[hist.length - 1].fecha)) : null,
      barList(saldosOrd.map((r) => ({label: r.cuenta, extra: r.entidad, valor: r.saldo, max: maxS, color: colGrupo[r.grupo] || css('--muted-bar'), valueText: eur2.format(r.saldo)})))));
  }

  // Evolución
  out.push(h('section', {class: 'card'},
    h('h2', null, 'Evolución del patrimonio'),
    h('p', {class: 'note'}, 'Un punto cada vez que guardas tus saldos o se actualizan los precios.'),
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
    h('ul', {class: 'lista fondos'}, rows.map((x) => {
      const g = x.valor - x.invertido, p = x.invertido ? g / x.invertido : 0, cls = g >= 0 ? 'ok' : 'bad';
      return h('li', null,
        h('span', {class: 'lista-txt'}, h('span', {class: 'fondo-nombre'}, x.fondo), h('span', {class: 'e'}, x.tipo + (x.fecha_vl ? ' · precio del ' + fechaCorta(x.fecha_vl) : ''))),
        h('span', {class: 'fondo-cifras'}, h('span', null, eur2.format(x.valor)), h('span', {class: 'e ' + cls}, signed(g) + ' · ' + (p >= 0 ? '+' : '') + pct1.format(p))));
    })));
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

/* ───────────────────────── Vista: Gastos (por meses) ───────────────────────── */

let mesGastosSel = null;

function mesesDisponibles() {
  const set = new Set([hoy().slice(0, 7)]);
  state.gastos.forEach((g) => g.fecha && set.add(String(g.fecha).slice(0, 7)));
  state.presupuesto.forEach((p) => p.mes && set.add(p.mes));
  return [...set].sort();
}
const mesLargo = (ym) => { const n = mesNombre(ym); return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + ym.slice(0, 4); };

function vistaGastos() {
  const st = state;
  const meses = mesesDisponibles();
  if (!mesGastosSel || !meses.includes(mesGastosSel)) mesGastosSel = hoy().slice(0, 7);
  const sel = mesGastosSel;
  const i = meses.indexOf(sel);
  const ir = (m) => { mesGastosSel = m; render(); };
  const gm = calcGastosMes(st, sel);
  const delMes = st.gastos.filter((g) => String(g.fecha).slice(0, 7) === sel).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const out = [];

  // Selector de mes + total
  out.push(h('section', {class: 'card'},
    h('div', {class: 'mes-nav'},
      h('button', {class: 'icon-btn grande', type: 'button', 'aria-label': 'Mes anterior', disabled: i <= 0, onclick: () => ir(meses[i - 1])}, '‹'),
      h('h2', null, mesLargo(sel)),
      h('button', {class: 'icon-btn grande', type: 'button', 'aria-label': 'Mes siguiente', disabled: i >= meses.length - 1, onclick: () => ir(meses[i + 1])}, '›')),
    h('div', {class: 'total-mes'},
      h('span', {class: 'heroe-num'}, eur2.format(gm.gastado)),
      h('span', {class: 'sub'}, gm.previsto ? 'gastado de ' + eur0.format(gm.previsto) + ' previstos' : 'gastado · ' + delMes.length + ' movimientos')),
    gm.previsto ? h('span', {class: 'track'}, h('span', {class: 'fill', style: `width:${Math.min(100, Math.max(0, gm.gastado) / gm.previsto * 100)}%;background:${gm.gastado > gm.previsto ? css('--bad') : css('--accent')}`})) : null,
    gm.previsto ? h('p', {class: 'sub'}, gm.gastado <= gm.previsto ? 'Te quedan ' + eur0.format(gm.previsto - gm.gastado) + ' este mes.' : h('span', {class: 'bad'}, 'Te has pasado ' + eur0.format(gm.gastado - gm.previsto) + '.')) : null,
    h('div', {class: 'btns'},
      h('button', {class: 'btn pri', type: 'button', onclick: () => editRow('gastos', null, {fecha: sel === hoy().slice(0, 7) ? hoy() : sel + '-01'})}, '+ Añadir gasto'),
      h('a', {class: 'btn', href: '#presupuesto'}, 'Presupuesto'))));

  // Por categoría
  if (gm.rows.length) {
    const max = Math.max(1, ...gm.rows.map((x) => Math.max(x.previsto, x.gastado)));
    const rows = gm.rows.slice().sort((a, b) => b.gastado - a.gastado || b.previsto - a.previsto);
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Por categoría'),
      gm.previsto ? h('p', {class: 'note'}, 'La barra clara es lo previsto; la de color, lo gastado.') : null,
      barList(rows.map((x) => ({
        label: x.concepto, extra: x.pendiente ? 'sin cifra prevista' : null, extraClass: 'warn',
        valor: x.gastado, max, color: x.previsto && x.gastado > x.previsto ? css('--bad') : css('--c0'),
        fondo: x.previsto ? {valor: x.previsto, color: css('--muted-bar')} : null,
        valueText: eur2.format(x.gastado) + (x.previsto ? ' de ' + eur0.format(x.previsto) : ''),
        valueClass: x.gastado < 0 ? 'ok' : x.previsto > 0 && x.gastado > x.previsto ? 'bad' : ''
      })))));
  }

  // Movimientos del mes
  out.push(h('section', {class: 'card'},
    h('h2', null, 'Movimientos'),
    delMes.length
      ? h('ul', {class: 'lista'}, delMes.map((g) => h('li', null,
        h('button', {class: 'lista-btn', type: 'button', onclick: () => editRow('gastos', g.id)},
          h('span', {class: 'lista-fecha'}, fechaCorta(g.fecha)),
          h('span', {class: 'lista-txt'}, h('span', null, g.concepto), h('span', {class: 'e'}, g.categoria)),
          h('span', {class: 'lista-imp ' + (g.importe < 0 ? 'ok' : '')}, eur2.format(g.importe))))))
      : h('p', {class: 'empty'}, 'No hay gastos en ' + mesNombre(sel) + '. Pulsa «Añadir gasto».'),
    delMes.length ? h('p', {class: 'note'}, 'Toca un gasto para cambiarlo o borrarlo. Las devoluciones y los Bizum que te devuelven van en negativo.') : null));

  // Últimos meses
  const ultimos = meses.filter((m) => m <= hoy().slice(0, 7)).slice(-6);
  if (ultimos.length > 1) {
    const totales = ultimos.map((m) => ({m, t: sum(st.gastos.filter((g) => String(g.fecha).slice(0, 7) === m), (g) => g.importe)}));
    const max = Math.max(1, ...totales.map((x) => x.t));
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Últimos meses'),
      h('div', {class: 'columnas'}, totales.map((x) => h('button', {class: 'columna' + (x.m === sel ? ' activa' : ''), type: 'button', onclick: () => ir(x.m), 'aria-label': mesLargo(x.m) + ': ' + eur0.format(x.t)},
        h('span', {class: 'col-num'}, eur0.format(x.t)),
        h('span', {class: 'col-barra'}, h('span', {style: `height:${Math.max(2, Math.max(0, x.t) / max * 100)}%`})),
        h('span', {class: 'col-mes'}, mesNombre(x.m).slice(0, 3))))),
      h('p', {class: 'note'}, 'Toca un mes para verlo.')));
  }
  return out;
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
        h('div', {class: 'btns'},
          h('button', {class: 'btn pri', type: 'button', onclick: guardar}, 'Guardar saldos'),
          h('a', {class: 'btn', href: '#historial'}, 'Historial'))) : null),
    tablaEditable('saldos')
  ];
}

/* ───────────────────────── Vista: Inversión ───────────────────────── */

function vistaInversion() {
  const st = state;
  const res = calcResumen(st);
  const inv = st.saldos.filter((r) => r.grupo === 'Inversión');
  const rem = st.saldos.filter((r) => r.grupo === 'Cuenta remunerada');
  const nombreInv = (inv.find((r) => r.entidad) || {}).entidad || 'Cartera';
  const nombreRem = (rem.find((r) => r.entidad) || {}).entidad || 'Cuenta remunerada';
  const porInvertir = sum(inv.filter((r) => /por invertir/i.test(r.cuenta)), (r) => r.saldo);
  const out = [];

  // Cartera de fondos
  out.push(h('h2', {class: 'seccion'}, nombreInv, h('span', null, ' · cartera de fondos')));
  if (st.cartera.length) {
    out.push(h('section', {class: 'heroe heroe-peq'},
      h('span', {class: 'heroe-lbl'}, 'Valor de los fondos'),
      h('span', {class: 'heroe-num'}, eur2.format(res.fondos)),
      h('span', {class: 'heroe-sub'}, h('span', {class: res.ganancia >= 0 ? 'ok' : 'bad'}, signed(res.ganancia) + ' (' + (res.rentabilidad >= 0 ? '+' : '') + pct1.format(res.rentabilidad) + ')'), ' sobre ' + eur2.format(res.invertido) + ' aportados'),
      porInvertir ? h('span', {class: 'heroe-sub'}, 'Además, ' + eur2.format(porInvertir) + ' por invertir') : null));
    out.push(carteraCard(res));
  }
  out.push(h('section', {class: 'card'},
    h('h2', null, 'Precios de los fondos'),
    h('p', {class: 'note'}, 'Cada lunes se busca el valor liquidativo de cada ISIN. Al abrir la app se recalcula el valor de cada fondo con tus participaciones.'),
    h('p', {class: 'note'}, preciosEstado),
    h('div', {class: 'btns'}, h('button', {class: 'btn', type: 'button', onclick: () => actualizarPrecios(true)}, 'Buscar precios ahora'))));
  out.push(tablaEditable('cartera', {orden: (a, b) => b.valor - a.valor, cols: ['fondo', 'participaciones', 'fecha_vl', 'valor']}));

  // Cuenta remunerada
  out.push(h('h2', {class: 'seccion'}, nombreRem, h('span', null, ' · cuenta remunerada')));
  if (rem.length) {
    const saldo = sum(rem, (r) => r.saldo);
    const tae = st.config.interesTR;
    const aportado = sum(st.movimientos.filter((m) => m.destino === DESTINOS[0]), (m) => m.importe);
    out.push(h('section', {class: 'heroe heroe-peq'},
      h('span', {class: 'heroe-lbl'}, 'Saldo'),
      h('span', {class: 'heroe-num'}, eur2.format(saldo)),
      tae > 0
        ? h('span', {class: 'heroe-sub'}, 'Al ' + tae.toLocaleString('es-ES') + ' % TAE te da unos ', h('b', null, eur2.format(saldo * tae / 100 / 12)), ' al mes (' + eur0.format(saldo * tae / 100) + ' al año)')
        : h('span', {class: 'heroe-sub'}, 'Pon el interés (TAE) en Ajustes para ver cuánto te da al mes.'),
      aportado ? h('span', {class: 'heroe-sub'}, 'Transferencias apuntadas en la app: ' + eur2.format(aportado)) : null));
    out.push(h('div', {class: 'btns'}, h('a', {class: 'btn', href: '#saldos'}, 'Actualizar saldo'), h('a', {class: 'btn', href: '#ajustes'}, 'Cambiar TAE')));
  } else {
    out.push(emptyMsg('No tienes ninguna cuenta del grupo «Cuenta remunerada».', '#saldos', 'Añadir cuenta'));
  }
  return out;
}

/* ───────────────────────── Precios automáticos ───────────────────────── */

let preciosEstado = 'Aún no se han consultado los precios en esta sesión.';

/* precios.json lo genera cada lunes la acción de GitHub (scripts/precios.py).
 * Se lee de raw.githubusercontent.com para tener siempre la última versión. */
function urlPrecios() {
  if (state.config.fuentePrecios) return state.config.fuentePrecios;
  const host = location.hostname;
  if (host.endsWith('.github.io')) {
    const usuario = host.split('.')[0];
    const repo = location.pathname.split('/').filter(Boolean)[0];
    if (repo) return `https://raw.githubusercontent.com/${usuario}/${repo}/main/precios.json`;
  }
  return 'precios.json';
}

const round2 = (n) => Math.round(n * 100) / 100;

/* Aplica los precios a los fondos. Devuelve cuántos fondos cambiaron y la diferencia de valor. */
function aplicarPrecios(datos) {
  const fondos = (datos && datos.fondos) || {};
  let cambiados = 0, antes = 0, despues = 0, fechaMax = '';
  for (const f of state.cartera) {
    const p = fondos[String(f.isin).trim().toUpperCase()];
    if (!p || !(Number(p.vl_eur) > 0) || !(f.participaciones > 0)) continue;
    const fecha = String(p.fecha || '').slice(0, 10);
    if (f.fecha_vl && fecha && fecha <= f.fecha_vl) continue; // ya aplicado o más antiguo
    const nuevo = round2(f.participaciones * Number(p.vl_eur));
    antes += f.valor; despues += nuevo;
    f.valor = nuevo;
    f.valor_liquidativo = Number(p.vl) || f.valor_liquidativo;
    if (p.moneda) f.moneda = String(p.moneda);
    if (fecha) { f.fecha_vl = fecha; if (fecha > fechaMax) fechaMax = fecha; }
    cambiados++;
  }
  if (cambiados) {
    // El saldo de la cuenta de la cartera pasa a ser el valor total de los fondos.
    const inv = state.saldos.filter((r) => r.grupo === 'Inversión');
    const cuenta = inv.find((r) => /^cartera indexada$/i.test(r.cuenta.trim())) || inv.find((r) => !/por invertir/i.test(r.cuenta));
    if (cuenta) cuenta.saldo = round2(sum(state.cartera, (r) => r.valor));
    fotoSaldos(hoy());
    save();
  }
  return {cambiados, diferencia: round2(despues - antes), fecha: fechaMax};
}

let buscandoPrecios = false;
async function actualizarPrecios(manual) {
  if (buscandoPrecios || !state.cartera.some((f) => f.isin)) {
    if (manual) toast('Añade el ISIN de tus fondos para poder buscar precios');
    return;
  }
  buscandoPrecios = true;
  try {
    const res = await fetch(urlPrecios() + '?t=' + Date.now(), {cache: 'no-store'});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const datos = await res.json();
    const r = aplicarPrecios(datos);
    const cuando = datos.actualizado ? new Date(datos.actualizado).toLocaleDateString('es-ES', {day: 'numeric', month: 'long'}) : '—';
    const faltan = state.cartera.filter((f) => f.isin && !(datos.fondos || {})[String(f.isin).trim().toUpperCase()]).length;
    preciosEstado = 'Precios consultados por última vez el ' + cuando + '.' + (faltan ? ' Sin precio para ' + faltan + ' fondo(s).' : '');
    if (r.cambiados) toast('Precios del ' + fechaCorta(r.fecha) + ': cartera ' + signed(r.diferencia));
    else if (manual) toast('Los precios ya estaban al día');
    render();
  } catch (e) {
    preciosEstado = 'No se pudieron leer los precios (' + (navigator.onLine ? 'aún no hay precios.json o falló la descarga' : 'sin conexión') + ').';
    if (manual) { toast('No se pudieron leer los precios'); render(); }
  } finally {
    buscandoPrecios = false;
  }
}

const volver = () => h('a', {class: 'back', href: '#ajustes'}, '← Ajustes');

function vistaNominas() {
  return [volver(),
    tablaEditable('ingresos', {orden: (a, b) => (a.mes < b.mes ? 1 : -1)}),
    tablaEditable('movimientos', {orden: (a, b) => (a.fecha < b.fecha ? 1 : -1)})];
}
function vistaPresupuesto() {
  return [h('a', {class: 'back', href: '#gastos'}, '← Gastos'), tablaEditable('presupuesto', {orden: (a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0)})];
}
function vistaHistorial() {
  return [h('a', {class: 'back', href: '#saldos'}, '← Saldos'), tablaEditable('historial', {orden: (a, b) => (a.fecha < b.fecha ? 1 : -1)})];
}

/* ───────────────────────── Tema (claro / oscuro) ───────────────────────── */

const TEMA_KEY = 'patrimonio-tema';
function temaActual() {
  try { return localStorage.getItem(TEMA_KEY) || 'auto'; } catch (e) { return 'auto'; }
}
function aplicarTema(t) {
  const raiz = document.documentElement;
  if (t === 'claro' || t === 'oscuro') raiz.dataset.theme = t; else delete raiz.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', css('--bg') || '#011811');
}
function cambiarTema(t) {
  try { localStorage.setItem(TEMA_KEY, t); } catch (e) { /* sin almacenamiento */ }
  aplicarTema(t);
  render();
}
aplicarTema(temaActual());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(temaActual()));

/* ───────────────────────── Vista: Ajustes ───────────────────────── */

function vistaAjustes() {
  const c = state.config;
  const tema = temaActual();
  const opcion = (valor, texto) => h('button', {class: 'seg' + (tema === valor ? ' activo' : ''), type: 'button', 'aria-pressed': tema === valor ? 'true' : 'false', onclick: () => cambiarTema(valor)}, texto);

  const f = (k, l, attrs) => h('label', {class: 'f', for: 'c-' + k}, l, h('input', {id: 'c-' + k, name: k, value: String(c[k]), ...attrs}));
  const form = h('form', {class: 'form'},
    h('div', {class: 'row'},
      f('nombre', 'Tu nombre (aparece junto a PatriApp)', {type: 'text', autocomplete: 'off'}),
      f('margen', 'Margen en la cuenta corriente (€)', {type: 'number', step: '1', inputmode: 'decimal'}),
      h('label', {class: 'f', for: 'c-pctTR'}, '% de lo que sobra a la cuenta remunerada',
        h('input', {id: 'c-pctTR', name: 'pctTR', type: 'number', step: '1', min: '0', max: '100', value: String(Math.round(c.pctTR * 100))})),
      f('interesTR', 'Interés de la cuenta remunerada (% TAE)', {type: 'number', step: '0.01', min: '0', inputmode: 'decimal'}),
      f('mesesColchon', 'Meses de colchón objetivo', {type: 'number', step: '1', min: '0'}),
      f('cuotaCoche', 'Cuota mensual del coche (€, 0 = ninguna)', {type: 'number', step: '0.01', inputmode: 'decimal'})),
    h('label', {class: 'chk'}, h('input', {type: 'checkbox', name: 'preciosAuto', checked: c.preciosAuto}), 'Actualizar los precios de los fondos al abrir la app'),
    h('div', {class: 'btns'}, h('button', {class: 'btn pri', type: 'submit'}, 'Guardar')));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e = form.elements;
    state.config = {
      ...state.config,
      nombre: e.nombre.value.trim(),
      margen: Number(e.margen.value) || 0,
      pctTR: Math.min(100, Math.max(0, Number(e.pctTR.value) || 0)) / 100,
      interesTR: Math.max(0, Number(String(e.interesTR.value).replace(',', '.')) || 0),
      mesesColchon: Number(e.mesesColchon.value) || 0,
      cuotaCoche: Number(e.cuotaCoche.value) || 0,
      preciosAuto: e.preciosAuto.checked
    };
    save();
    render();
    toast('Ajustes guardados');
  });

  const enlaces = [
    ['#cuenta', 'Cuenta y seguridad', 'Sesión, contraseña y bloqueo con código'],
    ['#nominas', 'Nóminas y transferencias', 'Lo que cobras y lo que mueves a ahorro e inversión'],
    ['#presupuesto', 'Presupuesto', 'Gastos previstos por mes y categoría'],
    ['#historial', 'Historial de saldos', 'Las fotos de la evolución del patrimonio'],
    ['#datos', 'Copia de seguridad', 'Exportar, importar o borrar tus datos']
  ];
  return [
    h('section', {class: 'card'},
      h('h2', null, 'Apariencia'),
      h('p', {class: 'note'}, 'En «Automático» sigue el modo claro u oscuro del móvil.'),
      h('div', {class: 'segmentos', role: 'group', 'aria-label': 'Tema'}, opcion('auto', 'Automático'), opcion('claro', 'Claro'), opcion('oscuro', 'Oscuro'))),
    h('section', {class: 'card'},
      h('h2', null, 'Reglas y preferencias'),
      h('p', {class: 'note'}, 'Con la última nómina: en la cuenta corriente se quedan los gastos previstos del mes siguiente más el margen; lo que sobra se reparte entre la cuenta remunerada y la cartera, en decenas.'),
      form),
    h('nav', {class: 'links'}, enlaces.map(([href, t, d]) => h('a', {href}, t, h('span', null, d))))
  ];
}

function vistaDatos() {
  const file = h('input', {type: 'file', accept: 'application/json,.json', hidden: true});
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const nuevo = normalize(raw);
      const n = totalFilas(nuevo);
      if (!n) { toast('El archivo no tiene datos reconocibles'); return; }
      if (!confirm('Se sustituirán tus datos actuales por los del archivo (' + n + ' filas). ¿Seguir?')) return;
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
    if (!confirm('¿Borrar TODOS tus datos? Exporta antes una copia si la quieres conservar.')) return;
    state = emptyState();
    save();
    render();
    toast('Datos borrados');
  };
  return [volver(), h('section', {class: 'card'},
    h('h2', null, 'Copia de seguridad'),
    h('p', {class: 'note'}, textoAlmacen()),
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
  inversion: [vistaInversion, 'inversion'],
  saldos: [vistaSaldos, 'saldos'],
  ajustes: [vistaAjustes, 'ajustes'],
  nominas: [vistaNominas, 'ajustes'],
  presupuesto: [vistaPresupuesto, 'gastos'],
  historial: [vistaHistorial, 'saldos'],
  datos: [vistaDatos, 'ajustes'],
  cuenta: [() => vistaCuenta(), 'ajustes'],
  // direcciones antiguas
  cartera: [vistaInversion, 'inversion'],
  mas: [vistaAjustes, 'ajustes']
};

let ultimaVista = null;
function render() {
  const vista = document.getElementById('vista');
  /* Pantallas de inicio de sesión, código, etc. (cuenta.js) */
  if (window.pantallaCuenta) {
    document.body.classList.add('sin-sesion');
    document.getElementById('titulo').textContent = 'PatriApp';
    vista.replaceChildren(...[window.pantallaCuenta()].flat(Infinity).filter(Boolean));
    ultimaVista = null;
    return;
  }
  document.body.classList.remove('sin-sesion');
  const nombre = (location.hash || '#panel').slice(1);
  const [fn, tab] = VISTAS[nombre] || VISTAS.panel;
  const titulo = state.config.nombre ? 'PatriApp · ' + state.config.nombre : 'PatriApp';
  document.getElementById('titulo').textContent = titulo;
  document.title = titulo;
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  vista.replaceChildren(...fn().flat().filter(Boolean));
  if (ultimaVista !== nombre) { window.scrollTo(0, 0); ultimaVista = nombre; }
}

window.addEventListener('hashchange', render);
let anchoPrevio = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - anchoPrevio) > 40) { anchoPrevio = window.innerWidth; render(); } });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
/* El arranque (sesión, código, carga de datos) está en cuenta.js. */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

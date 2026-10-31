/* PatriApp — app de seguimiento de patrimonio.
 * Todo se guarda en este dispositivo (localStorage). Nada se envía a ningún servidor.
 * Usa «Más → Copia de seguridad» para exportar o importar tus datos en JSON. */
'use strict';

/* ───────────────────────── Datos y almacenamiento ───────────────────────── */

const KEY = 'patrimonio-v1';

const GRUPOS = ['Liquidez', 'Efectivo', 'Apartado para el coche', 'Fondo de emergencia', 'Cuenta remunerada', 'Inversión', 'Otros'];
/* Destinos de las transferencias: salen de tus propias cuentas (cuenta remunerada y cartera). */
const DESTINOS_FIJOS = ['Fondo de emergencia', 'Otro'];
function destinos() {
  const rem = state.saldos.find((r) => r.grupo === 'Cuenta remunerada');
  const inv = (typeof cuentaCartera === 'function' && cuentaCartera()) || state.saldos.find((r) => r.grupo === 'Inversión');
  return [
    rem ? (rem.entidad || rem.cuenta) : 'Cuenta remunerada',
    inv ? inv.cuenta + (inv.entidad ? ' (' + inv.entidad + ')' : '') : 'Cartera de inversión',
    ...DESTINOS_FIJOS
  ];
}
const TIPOS_FONDO = ['Renta variable', 'Renta fija'];

const DEFAULT_CONFIG = {
  nombre: '',
  mesesColchon: 6,   // meses de gastos que debe cubrir el colchón
  pctTR: 0.35,       // parte de lo que sobra que va a la cuenta remunerada
  margen: 250,       // € que se quedan en la cuenta corriente además de los gastos previstos
  cuotaCoche: 0,     // € al mes de la cuota del coche (0 = no mostrar)
  interesTR: 0,      // % TAE de la cuenta remunerada (0 = no mostrar intereses)
  fireGasto: 0,      // objetivo FIRE: gasto mensual al retirarse (0 = calcularlo)
  fireAporte: 0,     // aportación mensual (0 = calcularla con las transferencias)
  fireRent: 5,       // rentabilidad anual esperada (%)
  fireTasa: 4,       // tasa de retirada (%)
  fireEdad: 0,       // edad actual (0 = no mostrar)
  fireBase: 'inversion', // 'inversion' (inversión + ahorro) o 'todo' (todo el patrimonio)
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
      {k: 'destino', l: 'Destino', t: 'select', opts: () => destinos()},
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
  recurrentes: {
    titulo: 'Gastos recurrentes', nuevo: 'Nuevo recurrente',
    ayuda: 'Se apuntan solos cada mes el día indicado. Si luego importas los movimientos del banco, se detectan y no se duplican.',
    inicial: () => ({activo: true, dia: new Date().getDate()}),
    cols: [
      {k: 'concepto', l: 'Concepto', t: 'text', req: true},
      {k: 'categoria', l: 'Categoría', t: 'text', list: 'categorias', req: true},
      {k: 'importe', l: 'Importe', t: 'money', req: true},
      {k: 'dia', l: 'Día del mes', t: 'number', req: true},
      {k: 'activo', l: 'Activo', t: 'bool'},
      {k: 'ultimo', l: 'Último mes apuntado', t: 'month', oculto: true}
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
  for (const k of ['mesesColchon', 'pctTR', 'margen', 'cuotaCoche', 'interesTR', 'fireGasto', 'fireAporte', 'fireRent', 'fireTasa', 'fireEdad']) s.config[k] = Number(s.config[k]) || 0;
  s.config.nombre = String(s.config.nombre || '');
  s.config.preciosAuto = s.config.preciosAuto !== false;
  s.config.fuentePrecios = String(s.config.fuentePrecios || '');
  s.config.fireBase = s.config.fireBase === 'todo' ? 'todo' : 'inversion';
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
  const [d1, d2] = destinos();
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

let periodoGrafico = 'todo';
const PERIODOS = [['1m', '1M', 31], ['3m', '3M', 92], ['1a', '1A', 366], ['todo', 'Todo', 0]];

function vistaPanel() {
  const st = state;
  const res = calcResumen(st);
  const mg = calcMesGastos(st);
  const col = calcColchon(st, mg);
  const rep = calcReparto(st, mg);
  const out = [];

  if (!st.saldos.length && !st.gastos.length) {
    out.push(h('section', {class: 'card bienvenida'},
      h('h2', null, 'Bienvenido a PatriApp'),
      h('p', {class: 'note'}, 'Configúrala en un minuto o importa una copia de seguridad.'),
      h('div', {class: 'btns'},
        h('a', {class: 'btn pri', href: '#bienvenida'}, 'Empezar'),
        h('a', {class: 'btn', href: '#datos'}, 'Importar datos'))));
  }

  // Serie para el gráfico: fotos de saldos + el valor de hoy
  const hist = st.historial.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const serie = hist.map((r) => ({fecha: r.fecha, valor: totHist(r)}));
  if (serie.length && serie[serie.length - 1].fecha === hoy()) serie[serie.length - 1].valor = res.patrimonio;
  else serie.push({fecha: hoy(), valor: res.patrimonio});
  const dias = (PERIODOS.find((p) => p[0] === periodoGrafico) || PERIODOS[3])[2];
  let tramo = serie;
  if (dias) {
    const corte = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
    const antes = serie.filter((p) => p.fecha < corte);
    tramo = serie.filter((p) => p.fecha >= corte);
    if (antes.length) tramo = [antes[antes.length - 1], ...tramo];
  }
  if (tramo.length === 1) tramo = [{...tramo[0]}, tramo[0]];
  const inicio = tramo[0].valor, fin = tramo[tramo.length - 1].valor, dif = fin - inicio;
  const pct = inicio ? dif / inicio : 0;

  const num = h('span', {class: 'heroe-num', id: 'heroe-num'}, eur2.format(res.patrimonio));
  const sub = h('span', {class: 'heroe-sub'});
  const pintarSub = (p) => {
    if (p) { sub.replaceChildren(fechaLarga(p.fecha)); num.textContent = eur2.format(p.valor); return; }
    num.textContent = eur2.format(res.patrimonio);
    sub.replaceChildren(
      h('span', {class: 'pill ' + (dif >= 0 ? 'pill-ok' : 'pill-bad')}, (dif >= 0 ? '▲ ' : '▼ ') + eur2.format(Math.abs(dif)) + ' · ' + pct1.format(Math.abs(pct))),
      ' ' + (periodoGrafico === 'todo' ? (serie.length > 1 ? 'desde el ' + fechaCorta(serie[0].fecha) : 'primer registro') : 'en ' + {'1m': '1 mes', '3m': '3 meses', '1a': '1 año'}[periodoGrafico]));
  };
  pintarSub(null);

  out.push(h('section', {class: 'heroe'},
    h('span', {class: 'heroe-lbl'}, 'Patrimonio neto'),
    num, sub,
    graficoArea(tramo, pintarSub),
    h('div', {class: 'chips', role: 'group', 'aria-label': 'Periodo'}, PERIODOS.map(([k, t]) =>
      h('button', {class: 'chip' + (periodoGrafico === k ? ' activo' : ''), type: 'button', 'aria-pressed': periodoGrafico === k ? 'true' : 'false', onclick: () => { periodoGrafico = k; render(); }}, t))),
    serie.length < 3 ? h('p', {class: 'note centro'}, 'El gráfico crecerá cada vez que guardes tus saldos o se actualicen los precios.') : null));

  // Resumen rápido
  const ahorro = sum(st.saldos.filter((r) => r.grupo === 'Cuenta remunerada'), (r) => r.saldo);
  const kpi = (label, valor, ico, color, href) => h('a', {class: 'kpi', href},
    h('span', {class: 'avatar sm', style: '--c:' + color}, icono(ico)),
    h('span', {class: 'kpi-lbl'}, label), h('span', {class: 'kpi-num'}, valor));
  out.push(h('div', {class: 'kpis'},
    kpi('Disponible', eur0.format(res.liquidez), 'banco', '#94a3b8', '#saldos'),
    kpi('Invertido', eur0.format(res.inversion + ahorro), 'inversion', '#76e78e', '#inversion'),
    kpi('Colchón', col.gastoMes ? col.meses.toLocaleString('es-ES', {maximumFractionDigits: 1}) + ' meses' : '—', 'escudo', '#fbbf24', '#saldos')));

  // Avisos
  out.push(tarjetaAvisos());

  // Objetivo FIRE
  if (st.saldos.length) out.push(tarjetaFire());

  // Este mes
  const mesHoy = hoy().slice(0, 7);
  const gm = calcGastosMes(st, mesHoy);
  const top = gm.rows.filter((r) => r.gastado > 0).sort((a, b) => b.gastado - a.gastado).slice(0, 3);
  out.push(h('a', {class: 'card card-enlace', href: '#gastos'},
    h('div', {class: 'card-cab'}, h('h2', null, 'Gastos de ' + mesNombre(mesHoy)), icono('chevron', 'chev')),
    h('div', {class: 'fila-sep'},
      h('span', {class: 'num-m'}, eur2.format(gm.gastado)),
      gm.previsto ? h('span', {class: 'sub'}, 'de ' + eur0.format(gm.previsto)) : null),
    gm.previsto ? h('span', {class: 'track'}, h('span', {class: 'fill', style: `width:${Math.min(100, Math.max(0, gm.gastado) / gm.previsto * 100)}%;background:${gm.gastado > gm.previsto ? css('--bad') : css('--accent')}`})) : null,
    top.length ? h('div', {class: 'mini-cats'}, top.map((r) => h('span', {class: 'mini-cat'}, avatarCategoria(r.concepto), h('span', null, r.concepto), h('b', null, eur0.format(r.gastado))))) : null));

  // Ahorro del último mes con nómina
  out.push(tarjetaAhorro());

  // Nómina
  if (rep && !rep.cerrada) {
    const c = st.config;
    out.push(h('section', {class: 'card'},
      h('div', {class: 'card-cab'}, h('h2', null, 'Reparte la nómina de ' + mesNombre(rep.nomina)), h('a', {class: 'btn-txt', href: '#nominas'}, 'Ver')),
      h('p', {class: 'note'}, 'Deja ' + eur0.format(mg.previsto + c.margen) + ' en la cuenta corriente y mueve el resto:'),
      h('ul', {class: 'lista'}, rep.rows.filter((x) => !x.otra).map((x, i) => h('li', {class: 'fila'},
        avatarGrupo(i === 0 ? 'Cuenta remunerada' : 'Inversión'),
        h('span', {class: 'fila-txt'}, h('span', null, x.destino), h('span', {class: 'e ' + (x.pendiente > 0 ? '' : 'ok')}, x.pendiente > 0 ? 'Pendiente ' + eur2.format(x.pendiente) : 'Hecho')),
        h('span', {class: 'fila-imp'}, eur2.format(x.importe))))),
      h('button', {class: 'btn ancho', type: 'button', onclick: () => editRow('movimientos', null, {fecha: hoy(), mes_nomina: rep.nomina, destino: destinos()[0]})}, 'Apuntar transferencia')));
  } else if (rep) {
    out.push(h('a', {class: 'aviso-fila', href: '#nominas'}, icono('check', 'ok'), 'Nómina de ' + mesNombre(rep.nomina) + ' repartida', icono('chevron', 'chev')));
  }

  // Distribución
  if (st.saldos.length) {
    const grupos = {};
    for (const r of st.saldos) grupos[r.grupo || 'Otros'] = (grupos[r.grupo || 'Otros'] || 0) + r.saldo;
    const lista = Object.entries(grupos).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = sum(lista, (x) => x[1]) || 1;
    out.push(h('section', {class: 'card'},
      h('div', {class: 'card-cab'}, h('h2', null, 'Dónde está tu dinero'), h('a', {class: 'btn-txt', href: '#saldos'}, 'Cuentas')),
      h('div', {class: 'reparto'}, lista.map(([g, v]) => h('span', {style: `flex:${v};background:${estiloGrupo(g)[1]}`}))),
      h('ul', {class: 'lista'}, lista.map(([g, v]) => h('li', {class: 'fila'},
        avatarGrupo(g),
        h('span', {class: 'fila-txt'}, h('span', null, g), h('span', {class: 'e'}, pct0.format(v / total))),
        h('span', {class: 'fila-imp'}, eur2.format(v)))))));
  }
  return out;
}

function carteraCard(res) {
  const st = state;
  const rows = st.cartera.slice().sort((a, b) => b.valor - a.valor);
  const tot = res.fondos || 1;
  const fija = sum(st.cartera.filter((r) => r.tipo === 'Renta fija'), (r) => r.valor);
  return h('section', {class: 'card'},
    h('div', {class: 'card-cab'}, h('h2', null, 'Fondos'), h('span', {class: 'sub'}, pct0.format(1 - fija / tot) + ' variable · ' + pct0.format(fija / tot) + ' fija')),
    h('div', {class: 'reparto'}, h('span', {style: `flex:${tot - fija};background:#76e78e`}), h('span', {style: `flex:${fija};background:#a78bfa`})),
    h('ul', {class: 'lista'}, rows.map((x) => {
      const g = x.valor - x.invertido, p = x.invertido ? g / x.invertido : 0;
      return h('li', null, h('button', {class: 'fila', type: 'button', onclick: () => editRow('cartera', x.id)},
        h('span', {class: 'avatar', style: '--c:' + (x.tipo === 'Renta fija' ? '#a78bfa' : '#76e78e')}, h('span', {class: 'avatar-txt'}, (x.fondo.match(/[A-Za-z]/) || ['?'])[0].toUpperCase())),
        h('span', {class: 'fila-txt'}, h('span', {class: 'multilinea'}, x.fondo), h('span', {class: 'e'}, x.tipo + (x.fecha_vl ? ' · ' + fechaCorta(x.fecha_vl) : ''))),
        h('span', {class: 'fila-imp'}, h('span', null, eur2.format(x.valor)), h('span', {class: 'e ' + (g >= 0 ? 'ok' : 'bad')}, (p >= 0 ? '+' : '') + pct1.format(p)))));
    })),
    h('button', {class: 'btn-txt', type: 'button', onclick: () => editRow('cartera', null)}, icono('mas'), 'Añadir fondo'));
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
    const base = typeof col.opts === 'function' ? col.opts() : col.opts;
    const opts = base.includes(valor) || !valor ? base : [valor, ...base];
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
    if (!el) continue;   // campos internos que no salen en el formulario
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
  const datos = fila || inicial || (sch.inicial ? sch.inicial() : {});
  const dlg = document.getElementById('dialogo');
  const form = document.getElementById('dialogo-form');
  dlg.onclose = null;
  form.replaceChildren(...[
    h('div', {class: 'asa', 'aria-hidden': 'true'}),
    h('div', {class: 'hoja-cab'},
      h('button', {class: 'btn-txt', type: 'button', onclick: () => dlg.close()}, 'Cancelar'),
      h('h3', null, fila ? 'Editar' : sch.nuevo),
      h('button', {class: 'btn-txt fuerte', type: 'submit'}, 'Guardar')),
    datalists(),
    h('div', {class: 'form'}, h('div', {class: 'row'}, sch.cols.filter((c) => !c.oculto).map((c) => campo(c, datos[c.k])))),
    tabla === 'movimientos' && !fila ? h('label', {class: 'chk'}, h('input', {type: 'checkbox', name: 'mover', checked: true}),
      'Mover el dinero en mis saldos (sale de la cuenta corriente; si va a la cartera, se reparte entre los fondos)') : null,
    sch.ayuda ? h('p', {class: 'note'}, sch.ayuda) : null,
    fila ? h('button', {class: 'btn pel ancho', type: 'button', onclick: () => borrar(tabla, id)}, 'Borrar') : null].filter(Boolean));
  form.onsubmit = (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const o = leerForm(form, sch.cols);
    let aviso = 'Guardado';
    if (fila) Object.assign(fila, o);
    else {
      if (tabla === 'recurrentes') o.ultimo = primerMesRecurrente(o);
      state[tabla].push({id: newId(), ...o});
      if (tabla === 'movimientos' && form.elements.mover && form.elements.mover.checked) {
        const d = aplicarTransferencia(o);
        if (d) aviso = 'Transferencia apuntada: ' + d;
      }
    }
    save();
    dlg.close();
    render();
    toast(aviso);
  };
  abrirHoja();
  // En el móvil, el primer campo vacío recibe el foco para escribir enseguida.
  if (!fila) setTimeout(() => { const i = form.querySelector('input[type=number], input[type=text]'); if (i && window.innerWidth > 700) i.focus(); }, 60);
}

async function borrar(tabla, id) {
  if (!(await confirmar('Esta acción no se puede deshacer.', {titulo: '¿Borrar?', aceptar: 'Borrar', peligro: true}))) return;
  state[tabla] = state[tabla].filter((r) => r.id !== id);
  save();
  render();
  toast('Borrado');
}

/* Lista de filas de una tabla: se toca una para editarla. */
function tablaEditable(tabla, {orden, limite, cols, titulo} = {}) {
  const sch = SCHEMAS[tabla];
  const visibles = (cols ? sch.cols.filter((c) => cols.includes(c.k)) : sch.cols).filter((c) => !c.oculto);
  let rows = state[tabla].slice();
  if (orden) rows.sort(orden);
  const total = rows.length;
  if (limite) rows = rows.slice(0, limite);
  const prim = visibles.find((c) => c.t === 'text') || visibles[0];
  const imp = [...visibles].reverse().find((c) => c.t === 'money');
  const resto = visibles.filter((c) => c !== prim && c !== imp);
  const texto2 = (r) => resto.map((c) => c.t === 'bool' ? (r[c.k] ? c.l : '') : fmtCell(c, r[c.k])).filter((x) => x !== '' && x != null).join(' · ');
  return h('section', {class: 'card'},
    h('div', {class: 'card-cab'}, h('h2', null, titulo || sch.titulo),
      h('button', {class: 'btn-txt', type: 'button', onclick: () => editRow(tabla, null)}, icono('mas'), 'Añadir')),
    total
      ? h('ul', {class: 'lista'}, rows.map((r) => h('li', null, h('button', {class: 'fila', type: 'button', onclick: () => editRow(tabla, r.id)},
        h('span', {class: 'fila-txt'}, h('span', null, fmtCell(prim, r[prim.k]) || '—'), h('span', {class: 'e'}, texto2(r))),
        imp ? h('span', {class: 'fila-imp ' + (r[imp.k] < 0 ? 'ok' : '')}, fmtCell(imp, r[imp.k])) : null,
        icono('chevron', 'chev')))))
      : h('p', {class: 'empty'}, 'Todavía no hay nada. Pulsa «Añadir».'),
    limite && total > limite ? h('p', {class: 'note'}, 'Mostrando ' + limite + ' de ' + total + '.') : null,
    sch.ayuda ? h('p', {class: 'note'}, sch.ayuda) : null);
}

/* ───────────────────────── Vistas de edición ───────────────────────── */

/* ───────────────────────── Vista: Gastos (por meses) ───────────────────────── */

let mesGastosSel = null;
let busquedaGastos = '';
let filtroCategoria = null;

/* Fila de un gasto en una lista. */
function filaGasto(g, conMes) {
  return h('li', null, h('button', {class: 'fila', type: 'button', onclick: () => editRow('gastos', g.id)},
    avatarCategoria(g.categoria),
    h('span', {class: 'fila-txt'}, h('span', null, g.concepto), h('span', {class: 'e'}, g.categoria + ' · ' + (conMes ? fechaLarga(g.fecha) : fechaCorta(g.fecha)))),
    h('span', {class: 'fila-imp ' + (g.importe < 0 ? 'ok' : '')}, (g.importe < 0 ? '+' : '−') + eur2.format(Math.abs(g.importe)))));
}

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

  out.push(h('div', {class: 'mes-nav'},
    h('button', {class: 'redondo', type: 'button', 'aria-label': 'Mes anterior', disabled: i <= 0, onclick: () => ir(meses[i - 1])}, icono('atras')),
    h('span', {class: 'mes-nombre'}, mesLargo(sel)),
    h('button', {class: 'redondo', type: 'button', 'aria-label': 'Mes siguiente', disabled: i >= meses.length - 1, onclick: () => ir(meses[i + 1])}, icono('chevron'))));

  const restante = gm.previsto - gm.gastado;
  out.push(h('section', {class: 'heroe heroe-centro'},
    h('span', {class: 'heroe-lbl'}, 'Gastado'),
    h('span', {class: 'heroe-num'}, eur2.format(gm.gastado)),
    gm.previsto
      ? [h('span', {class: 'track grueso'}, h('span', {class: 'fill', style: `width:${Math.min(100, Math.max(0, gm.gastado) / gm.previsto * 100)}%;background:${restante < 0 ? css('--bad') : css('--accent')}`})),
        h('span', {class: 'heroe-sub'}, restante >= 0 ? ['Te quedan ', h('b', null, eur0.format(restante)), ' de ' + eur0.format(gm.previsto)] : h('span', {class: 'bad'}, 'Te has pasado ' + eur0.format(-restante) + ' de ' + eur0.format(gm.previsto)))]
      : h('span', {class: 'heroe-sub'}, delMes.length + ' movimientos · ', h('a', {href: '#presupuesto'}, 'poner presupuesto'))));

  out.push(h('div', {class: 'accesos'},
    h('a', {class: 'acceso-btn', href: '#resumen'}, h('span', {class: 'avatar sm', style: '--c:#76e78e'}, icono('hucha')), 'Ahorro'),
    h('a', {class: 'acceso-btn', href: '#recurrentes'}, h('span', {class: 'avatar sm', style: '--c:#22d3ee'}, icono('repetir')), 'Fijos'),
    h('a', {class: 'acceso-btn', href: '#presupuesto'}, h('span', {class: 'avatar sm', style: '--c:#f472b6'}, icono('tarta')), 'Presupuesto'),
    h('a', {class: 'acceso-btn', href: '#importar'}, h('span', {class: 'avatar sm', style: '--c:#7aa2ff'}, icono('banco')), 'Importar')));

  if (gm.rows.length) {
    const rows = gm.rows.slice().sort((a, b) => b.gastado - a.gastado || b.previsto - a.previsto);
    const max = Math.max(1, ...rows.map((x) => Math.max(x.previsto, x.gastado)));
    out.push(h('section', {class: 'card'},
      h('div', {class: 'card-cab'}, h('h2', null, 'Por categoría'), h('span', {class: 'sub'}, 'Toca para filtrar')),
      h('ul', {class: 'lista'}, rows.map((x) => {
        const color = estiloCategoria(x.concepto).color;
        const pasa = x.previsto > 0 && x.gastado > x.previsto;
        return h('li', null, h('button', {class: 'fila fila-cat' + (filtroCategoria === x.concepto ? ' sel' : ''), type: 'button', onclick: () => { filtroCategoria = filtroCategoria === x.concepto ? null : x.concepto; render(); }},
          avatarCategoria(x.concepto),
          h('span', {class: 'fila-txt'},
            h('span', null, x.concepto),
            h('span', {class: 'track'},
              x.previsto ? h('span', {class: 'fill', style: `width:${x.previsto / max * 100}%;background:${color};opacity:.25`}) : null,
              h('span', {class: 'fill', style: `width:${Math.max(0, x.gastado) / max * 100}%;background:${pasa ? css('--bad') : color}`}))),
          h('span', {class: 'fila-imp'}, h('span', {class: x.gastado < 0 ? 'ok' : pasa ? 'bad' : ''}, eur2.format(x.gastado)), x.previsto ? h('span', {class: 'e'}, 'de ' + eur0.format(x.previsto)) : null)));
      }))));
  }

  // Movimientos: del mes (con filtro de categoría) o resultados de búsqueda en todos los meses
  const contenedor = h('div');
  const titulo = h('h2');
  const pintarMovs = () => {
    const q = sinTildes(busquedaGastos.trim());
    let lista, vacio;
    if (q) {
      lista = st.gastos.filter((g) => sinTildes(g.concepto + ' ' + g.categoria).includes(q)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      titulo.textContent = lista.length + ' resultados · ' + eur2.format(sum(lista, (g) => g.importe));
      vacio = 'Nada coincide con «' + busquedaGastos.trim() + '».';
    } else {
      lista = filtroCategoria ? delMes.filter((g) => g.categoria === filtroCategoria) : delMes;
      titulo.textContent = 'Movimientos · ' + lista.length;
      vacio = 'No hay gastos en ' + mesNombre(sel) + '. Pulsa + para añadir uno.';
    }
    contenedor.replaceChildren(lista.length ? h('ul', {class: 'lista'}, lista.slice(0, 200).map((g) => filaGasto(g, !!q))) : h('p', {class: 'empty'}, vacio));
  };
  const buscador = h('input', {type: 'search', class: 'buscador', placeholder: 'Buscar en todos los meses', value: busquedaGastos, 'aria-label': 'Buscar gastos', autocomplete: 'off'});
  buscador.addEventListener('input', () => { busquedaGastos = buscador.value; pintarMovs(); });
  pintarMovs();
  out.push(h('section', {class: 'card'},
    h('div', {class: 'card-cab'}, titulo),
    buscador,
    filtroCategoria && !busquedaGastos.trim() ? h('button', {class: 'chip-filtro', type: 'button', onclick: () => { filtroCategoria = null; render(); }}, avatarCategoria(filtroCategoria), filtroCategoria, h('span', {'aria-hidden': 'true'}, ' ✕')) : null,
    contenedor));

  const ultimos = meses.filter((m) => m <= hoy().slice(0, 7)).slice(-6);
  if (ultimos.length > 1) {
    const totales = ultimos.map((m) => ({m, t: sum(st.gastos.filter((g) => String(g.fecha).slice(0, 7) === m), (g) => g.importe)}));
    const max = Math.max(1, ...totales.map((x) => x.t));
    out.push(h('section', {class: 'card'},
      h('h2', null, 'Últimos meses'),
      h('div', {class: 'columnas'}, totales.map((x) => h('button', {class: 'columna' + (x.m === sel ? ' activa' : ''), type: 'button', onclick: () => ir(x.m), 'aria-label': mesLargo(x.m) + ': ' + eur0.format(x.t)},
        h('span', {class: 'col-num'}, eur0.format(x.t)),
        h('span', {class: 'col-barra'}, h('span', {style: `height:${Math.max(3, Math.max(0, x.t) / max * 100)}%`})),
        h('span', {class: 'col-mes'}, mesNombre(x.m).slice(0, 3)))))));
  }
  return out;
}

/* ───────────────────────── Vista: Saldos ───────────────────────── */

function vistaSaldos() {
  const fecha = h('input', {type: 'date', value: hoy(), id: 'f-foto', class: 'input-peq'});
  const guardar = () => {
    document.querySelectorAll('input[data-saldo]').forEach((inp) => {
      const r = state.saldos.find((x) => x.id === inp.dataset.saldo);
      if (r) r.saldo = coerce({t: 'money'}, inp.value);
    });
    if (fecha.value) fotoSaldos(fecha.value);
    save();
    render();
    toast('Saldos guardados');
  };
  const total = sum(state.saldos, (r) => r.saldo);
  const out = [h('section', {class: 'heroe heroe-peq'}, h('span', {class: 'heroe-lbl'}, 'Total en tus cuentas'), h('span', {class: 'heroe-num'}, eur2.format(total)))];
  if (state.saldos.length) {
    out.push(h('section', {class: 'card'},
      h('div', {class: 'card-cab'}, h('h2', null, 'Actualizar saldos'), h('a', {class: 'btn-txt', href: '#historial'}, 'Historial')),
      h('ul', {class: 'lista'}, state.saldos.map((r) => h('li', {class: 'fila'},
        avatarGrupo(r.grupo),
        h('span', {class: 'fila-txt'}, h('span', null, r.cuenta), h('span', {class: 'e'}, [r.entidad, r.grupo].filter(Boolean).join(' · '))),
        h('span', {class: 'input-euro'}, h('input', {type: 'number', step: '0.01', inputmode: 'decimal', value: String(r.saldo), 'data-saldo': r.id, 'aria-label': 'Saldo de ' + r.cuenta}), '€')))),
      h('div', {class: 'fila-sep'}, h('label', {class: 'sub', for: 'f-foto'}, 'Fecha'), fecha),
      h('button', {class: 'btn pri ancho', type: 'button', onclick: guardar}, 'Guardar saldos')));
  }
  out.push(tablaEditable('saldos', {titulo: 'Tus cuentas'}));
  return out;
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
  const ahorro = sum(rem, (r) => r.saldo);
  const out = [];

  out.push(h('section', {class: 'heroe heroe-peq'},
    h('span', {class: 'heroe-lbl'}, 'Total invertido y ahorrado'),
    h('span', {class: 'heroe-num'}, eur2.format(res.inversion + ahorro)),
    st.cartera.length ? h('span', {class: 'heroe-sub'}, h('span', {class: 'pill ' + (res.ganancia >= 0 ? 'pill-ok' : 'pill-bad')}, (res.ganancia >= 0 ? '▲ ' : '▼ ') + eur2.format(Math.abs(res.ganancia)) + ' · ' + pct1.format(Math.abs(res.rentabilidad))), ' de ganancia en fondos') : null));

  // Cartera de fondos
  out.push(h('h2', {class: 'seccion'}, avatarGrupo('Inversión'), nombreInv));
  if (st.cartera.length) {
    out.push(h('div', {class: 'kpis'},
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Valor fondos'), h('span', {class: 'kpi-num'}, eur0.format(res.fondos))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Aportado'), h('span', {class: 'kpi-num'}, eur0.format(res.invertido))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Por invertir'), h('span', {class: 'kpi-num'}, eur0.format(porInvertir)))));
    const estimada = st.config.carteraEstimadaDesde;
    out.push(h('a', {class: 'aviso-fila', href: '#ajustar-cartera'},
      icono(estimada ? 'reloj' : 'check', estimada ? 'warn' : 'ok'),
      h('span', null, estimada ? 'Participaciones estimadas desde el ' + fechaCorta(estimada) : st.config.carteraAjustada ? 'Ajustada con MyInvestor el ' + fechaCorta(st.config.carteraAjustada) : 'Ajustar con los datos de MyInvestor',
        h('span', {class: 'e-bloque'}, estimada ? 'Toca para ajustar con los datos reales de MyInvestor' : 'Valor total o participaciones de cada fondo')),
      icono('chevron', 'chev')));
    out.push(carteraCard(res));
    out.push(tarjetaImpuestos(res));
  } else {
    out.push(h('section', {class: 'card'}, h('p', {class: 'empty'}, 'Añade tus fondos con su ISIN y participaciones.'), h('button', {class: 'btn pri', type: 'button', onclick: () => editRow('cartera', null)}, 'Añadir fondo')));
  }
  out.push(h('section', {class: 'card'},
    h('div', {class: 'card-cab'}, h('h2', null, 'Precios'), h('button', {class: 'btn-txt', type: 'button', onclick: () => actualizarPrecios(true)}, 'Actualizar')),
    h('p', {class: 'note'}, preciosEstado + ' Se buscan solos cada lunes.')));

  // Cuenta remunerada
  out.push(h('h2', {class: 'seccion'}, avatarGrupo('Cuenta remunerada'), nombreRem));
  if (rem.length) {
    const tae = st.config.interesTR;
    const aportado = sum(st.movimientos.filter((m) => m.destino === destinos()[0]), (m) => m.importe);
    out.push(h('section', {class: 'card'},
      h('span', {class: 'heroe-lbl'}, 'Saldo'),
      h('span', {class: 'num-m'}, eur2.format(ahorro)),
      tae > 0
        ? h('div', {class: 'kpis dentro'},
          h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Interés al mes'), h('span', {class: 'kpi-num ok'}, '+' + eur2.format(ahorro * tae / 100 / 12))),
          h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Al año'), h('span', {class: 'kpi-num ok'}, '+' + eur0.format(ahorro * tae / 100))),
          h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'TAE'), h('span', {class: 'kpi-num'}, tae.toLocaleString('es-ES') + ' %')))
        : h('p', {class: 'note'}, 'Pon el interés (TAE) en Ajustes → Reglas para ver cuánto te da al mes.'),
      aportado ? h('p', {class: 'note'}, 'Transferencias apuntadas: ' + eur2.format(aportado)) : null,
      h('div', {class: 'btns'}, h('a', {class: 'btn', href: '#saldos'}, 'Actualizar saldo'), h('a', {class: 'btn', href: '#reglas'}, 'Cambiar TAE'))));
  } else {
    out.push(h('section', {class: 'card'}, h('p', {class: 'empty'}, 'No tienes ninguna cuenta del grupo «Cuenta remunerada».'), h('a', {class: 'btn', href: '#saldos'}, 'Añadir cuenta')));
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
    sincronizarSaldoCartera();
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

const volver = (href = '#ajustes', texto = 'Ajustes') => h('a', {class: 'back', href}, icono('atras'), texto);

function vistaNominas() {
  return [volver(),
    tablaEditable('ingresos', {orden: (a, b) => (a.mes < b.mes ? 1 : -1)}),
    tablaEditable('movimientos', {orden: (a, b) => (a.fecha < b.fecha ? 1 : -1)})];
}
function vistaPresupuesto() {
  return [volver('#gastos', 'Gastos'), tablaEditable('presupuesto', {orden: (a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0)})];
}
function vistaHistorial() {
  return [volver('#saldos', 'Saldos'), tablaEditable('historial', {orden: (a, b) => (a.fecha < b.fecha ? 1 : -1)})];
}

/* ───────────────────────── Tema (claro / oscuro) ───────────────────────── */

const TEMA_KEY = 'patrimonio-tema';
function temaActual() {
  try { return localStorage.getItem(TEMA_KEY) || 'oscuro'; } catch (e) { return 'oscuro'; }
}
function aplicarTema(t) {
  const raiz = document.documentElement;
  if (t === 'claro' || t === 'oscuro') raiz.dataset.theme = t; else delete raiz.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', css('--bg') || '#06110d');
}
function cambiarTema(t) {
  try { localStorage.setItem(TEMA_KEY, t); } catch (e) { /* sin almacenamiento */ }
  aplicarTema(t);
  render();
}
aplicarTema(temaActual());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { aplicarTema(temaActual()); render(); });

/* ───────────────────────── Vista: Ajustes ───────────────────────── */

function filaAjuste(href, ico, color, titulo, detalle) {
  return h('li', null, h('a', {class: 'fila', href},
    h('span', {class: 'avatar sm', style: '--c:' + color}, icono(ico)),
    h('span', {class: 'fila-txt'}, h('span', null, titulo), detalle ? h('span', {class: 'e'}, detalle) : null),
    icono('chevron', 'chev')));
}

function vistaAjustes() {
  const tema = temaActual();
  const opcion = (valor, texto) => h('button', {class: 'seg' + (tema === valor ? ' activo' : ''), type: 'button', 'aria-pressed': tema === valor ? 'true' : 'false', onclick: () => cambiarTema(valor)}, texto);
  const correo = typeof usuario !== 'undefined' && usuario ? usuario.email : 'Sin cuenta';
  return [
    h('h3', {class: 'grupo-tit'}, 'Apariencia'),
    h('section', {class: 'card'},
      h('div', {class: 'segmentos', role: 'group', 'aria-label': 'Tema'}, opcion('auto', 'Automático'), opcion('claro', 'Claro'), opcion('oscuro', 'Oscuro')),
      h('p', {class: 'note'}, '«Automático» sigue el modo del iPhone.')),
    h('h3', {class: 'grupo-tit'}, 'Cuenta'),
    h('ul', {class: 'grupo'},
      filaAjuste('#cuenta', 'usuario', '#76e78e', 'Cuenta y seguridad', correo),
      filaAjuste('#applepay', 'billete', '#f5f5f7', 'Pagos con Apple Pay', state.config.applePay ? 'Activado: los pagos se apuntan solos' : 'Desactivado')),
    h('h3', {class: 'grupo-tit'}, 'Tu dinero'),
    h('ul', {class: 'grupo'},
      filaAjuste('#reglas', 'regla', '#22d3ee', 'Reglas y preferencias', 'Reparto de la nómina, TAE, colchón'),
      filaAjuste('#fire', 'inversion', '#76e78e', 'Objetivo FIRE', 'Cuánto necesitas y cuándo llegas'),
      filaAjuste('#nominas', 'documento', '#7aa2ff', 'Nóminas y transferencias'),
      filaAjuste('#presupuesto', 'tarta', '#f472b6', 'Presupuesto'),
      filaAjuste('#recurrentes', 'repetir', '#22d3ee', 'Gastos recurrentes', 'Se apuntan solos cada mes'),
      filaAjuste('#resumen', 'hucha', '#76e78e', 'Resumen del mes', 'Ingresos, gastos y tasa de ahorro'),
      filaAjuste('#historial', 'reloj', '#fbbf24', 'Historial de saldos')),
    h('h3', {class: 'grupo-tit'}, 'Datos'),
    h('ul', {class: 'grupo'},
      filaAjuste('#importar', 'banco', '#7aa2ff', 'Importar del banco', 'Excel o CSV de BBVA u otro banco'),
      filaAjuste('#versiones', 'reloj', '#fbbf24', 'Historial de versiones', 'Vuelve atrás si algo sale mal'),
      filaAjuste('#datos', 'copia', '#94a3b8', 'Copia de seguridad', 'Exportar, importar o borrar')),
    h('h3', {class: 'grupo-tit'}, 'Ayuda'),
    h('ul', {class: 'grupo'}, h('li', null, h('button', {class: 'fila', type: 'button', onclick: () => mostrarTutorial(true)},
      h('span', {class: 'avatar sm', style: '--c:#f472b6'}, icono('luna')),
      h('span', {class: 'fila-txt'}, h('span', null, 'Ver el tutorial'), h('span', {class: 'e'}, 'Lo que puedes hacer con PatriApp')),
      icono('chevron', 'chev')))),
    h('p', {class: 'pie'}, 'PatriApp')
  ];
}

function vistaReglas() {
  const c = state.config;
  const f = (k, l, attrs) => h('label', {class: 'f', for: 'c-' + k}, l, h('input', {id: 'c-' + k, name: k, value: String(c[k]), ...attrs}));
  const form = h('form', {class: 'form'},
    h('div', {class: 'row'},
      f('nombre', 'Tu nombre', {type: 'text', autocomplete: 'off'}),
      f('margen', 'Margen en la cuenta corriente (€)', {type: 'number', step: '1', inputmode: 'decimal'}),
      h('label', {class: 'f', for: 'c-pctTR'}, '% de lo que sobra a la cuenta remunerada',
        h('input', {id: 'c-pctTR', name: 'pctTR', type: 'number', step: '1', min: '0', max: '100', value: String(Math.round(c.pctTR * 100))})),
      f('interesTR', 'Interés de la cuenta remunerada (% TAE)', {type: 'number', step: '0.01', min: '0', inputmode: 'decimal'}),
      f('mesesColchon', 'Meses de colchón objetivo', {type: 'number', step: '1', min: '0'}),
      f('cuotaCoche', 'Cuota mensual del coche (€, 0 = ninguna)', {type: 'number', step: '0.01', inputmode: 'decimal'})),
    h('label', {class: 'chk'}, h('input', {type: 'checkbox', name: 'preciosAuto', checked: c.preciosAuto}), 'Actualizar los precios de los fondos al abrir la app'),
    h('button', {class: 'btn pri ancho', type: 'submit'}, 'Guardar'));
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
    toast('Guardado');
    location.hash = '#ajustes';
  });
  return [volver(), h('section', {class: 'card'},
    h('h2', null, 'Reglas y preferencias'),
    h('p', {class: 'note'}, 'Con cada nómina, en la cuenta corriente se quedan los gastos previstos del mes siguiente más el margen; lo que sobra se reparte entre la cuenta remunerada y la cartera, en decenas.'),
    form)];
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
      if (!(await confirmar('Se sustituirán tus datos actuales por los del archivo (' + n + ' filas).', {titulo: '¿Importar?', aceptar: 'Importar'}))) return;
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
  const borrarTodo = async () => {
    if (!(await confirmar('Se borrarán todos tus datos. Exporta antes una copia si la quieres conservar.', {titulo: '¿Borrar todo?', aceptar: 'Borrar todo', peligro: true}))) return;
    state = emptyState();
    save();
    render();
    toast('Datos borrados');
  };
  return [volver(), h('section', {class: 'card'},
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
  gastos: [vistaGastos, 'gastos', 'Gastos'],
  inversion: [vistaInversion, 'inversion', 'Inversión'],
  saldos: [vistaSaldos, 'saldos', 'Saldos'],
  ajustes: [vistaAjustes, 'ajustes', 'Ajustes'],
  reglas: [vistaReglas, 'ajustes', 'Reglas'],
  nominas: [vistaNominas, 'ajustes', 'Nóminas'],
  presupuesto: [vistaPresupuesto, 'gastos', 'Presupuesto'],
  historial: [vistaHistorial, 'saldos', 'Historial'],
  datos: [vistaDatos, 'ajustes', 'Copia de seguridad'],
  cuenta: [() => vistaCuenta(), 'ajustes', 'Cuenta'],
  fire: [() => vistaFire(), 'panel', 'Objetivo FIRE'],
  importar: [() => vistaImportar(), 'gastos', 'Importar'],
  'ajustar-cartera': [() => vistaAjustarCartera(), 'inversion', 'Ajustar cartera'],
  resumen: [() => vistaResumen(), 'gastos', 'Resumen del mes'],
  recurrentes: [() => vistaRecurrentes(), 'gastos', 'Recurrentes'],
  bienvenida: [() => vistaBienvenida(), 'panel', 'Bienvenida'],
  versiones: [() => vistaVersiones(), 'ajustes', 'Versiones'],
  applepay: [() => vistaApplePay(), 'ajustes', 'Apple Pay'],
  // direcciones antiguas
  cartera: [vistaInversion, 'inversion', 'Inversión'],
  mas: [vistaAjustes, 'ajustes', 'Ajustes']
};

let ultimaVista = null;
function render() {
  const vista = document.getElementById('vista');
  /* Pantallas de inicio de sesión, código, etc. (cuenta.js) */
  if (window.pantallaCuenta) {
    document.body.classList.add('sin-sesion');
    document.getElementById('titulo').textContent = '';
    document.getElementById('fab').hidden = true;
    vista.replaceChildren(...[window.pantallaCuenta()].flat(Infinity).filter(Boolean));
    ultimaVista = null;
    return;
  }
  document.body.classList.remove('sin-sesion');
  const nombre = (location.hash || '#panel').slice(1);
  const [fn, tab, tituloVista] = VISTAS[nombre] || VISTAS.panel;
  const nombreUsuario = state.config.nombre;
  document.getElementById('titulo').textContent = tituloVista || (nombreUsuario ? 'Hola, ' + nombreUsuario : 'PatriApp');
  document.title = tituloVista ? tituloVista + ' · PatriApp' : 'PatriApp';
  const correo = typeof usuario !== 'undefined' && usuario ? usuario.email : '';
  document.getElementById('avatar').textContent = ((nombreUsuario || correo || 'P').trim()[0] || 'P').toUpperCase();
  const fab = document.getElementById('fab');
  fab.hidden = !(tab === 'panel' || tab === 'gastos') || ['presupuesto', 'importar', 'fire', 'nominas', 'resumen', 'recurrentes', 'bienvenida'].includes(nombre);
  document.querySelectorAll('.tabs [data-ico]').forEach((el) => { if (!el.firstChild) el.append(icono(el.dataset.ico)); });
  document.querySelectorAll('.tabs a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  vista.replaceChildren(...fn().flat(Infinity).filter(Boolean));
  if (ultimaVista !== nombre) {
    window.scrollTo(0, 0);
    vista.classList.remove('entra'); void vista.offsetWidth; vista.classList.add('entra');
    if (nombre === 'panel' || !VISTAS[nombre]) animarNumero(document.getElementById('heroe-num'), calcResumen(state).patrimonio, (v) => eur2.format(v));
    ultimaVista = nombre;
  }
}

window.addEventListener('hashchange', render);
document.getElementById('fab').addEventListener('click', () => {
  const mes = (location.hash === '#gastos' && typeof mesGastosSel === 'string') ? mesGastosSel : hoy().slice(0, 7);
  editRow('gastos', null, {fecha: mes === hoy().slice(0, 7) ? hoy() : mes + '-01'});
});
let anchoPrevio = window.innerWidth;
window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - anchoPrevio) > 40) { anchoPrevio = window.innerWidth; render(); } });
/* El arranque (sesión, código, carga de datos) está en cuenta.js. */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

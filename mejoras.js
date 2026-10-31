/* Recurrentes, resumen mensual, avisos, impuestos, bienvenida e historial de versiones. */
'use strict';

/* ───────────────────────── Gastos recurrentes ───────────────────────── */

const mesAnterior = (ym) => { let [y, m] = ym.split('-').map(Number); m -= 1; if (m < 1) { m = 12; y -= 1; } return y + '-' + String(m).padStart(2, '0'); };
const diasDelMes = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
const fechaRecurrente = (r, ym) => ym + '-' + String(Math.min(Math.max(1, Math.round(r.dia) || 1), diasDelMes(ym))).padStart(2, '0');

/* Un recurrente nuevo empieza en su próxima fecha: este mes si su día aún no ha llegado, si no el siguiente. */
function primerMesRecurrente(r) {
  const mes = hoy().slice(0, 7);
  return fechaRecurrente(r, mes) > hoy() ? mesAnterior(mes) : mes;
}

/* Apunta los recurrentes que tocan hasta hoy. Devuelve cuántos ha apuntado. */
function aplicarRecurrentes() {
  const mesHoy = hoy().slice(0, 7);
  let n = 0;
  for (const r of state.recurrentes) {
    if (!r.activo || !(r.importe > 0)) continue;
    let m = r.ultimo ? mesSiguiente(r.ultimo) : mesHoy;
    let vueltas = 0;
    while (m <= mesHoy && vueltas++ < 24) {
      const fecha = fechaRecurrente(r, m);
      if (fecha > hoy()) break;
      const ya = state.gastos.some((g) => String(g.fecha).slice(0, 7) === m && Math.abs(g.importe - r.importe) < 0.005 &&
        (g.concepto === r.concepto || g.categoria === r.categoria));
      if (!ya) { state.gastos.push({id: newId(), fecha, concepto: r.concepto, categoria: r.categoria, importe: r.importe}); n++; }
      r.ultimo = m;
      m = mesSiguiente(m);
    }
  }
  return n;
}

function vistaRecurrentes() {
  const total = sum(state.recurrentes.filter((r) => r.activo), (r) => r.importe);
  return [volver('#gastos', 'Gastos'),
    h('section', {class: 'heroe heroe-peq'},
      h('span', {class: 'heroe-lbl'}, 'Gastos fijos al mes'),
      h('span', {class: 'heroe-num'}, eur2.format(total)),
      h('span', {class: 'heroe-sub'}, state.recurrentes.filter((r) => r.activo).length + ' activos · se apuntan solos el día que toca')),
    tablaEditable('recurrentes', {orden: (a, b) => a.dia - b.dia})];
}

/* ───────────────────────── Resumen del mes y tasa de ahorro ───────────────────────── */

function resumenMes(st, m) {
  const ingresos = sum(st.ingresos.filter((i) => i.mes === m), (i) => i.importe);
  const gastos = sum(st.gastos.filter((g) => String(g.fecha).slice(0, 7) === m), (g) => g.importe);
  const invertido = sum(st.movimientos.filter((x) => x.mes_nomina === m), (x) => x.importe);
  const ahorro = ingresos - gastos;
  return {m, ingresos, gastos, invertido, ahorro, tasa: ingresos ? ahorro / ingresos : null};
}
function mesesConMovimiento(st) {
  const set = new Set([hoy().slice(0, 7)]);
  st.ingresos.forEach((i) => i.mes && set.add(i.mes));
  st.gastos.forEach((g) => g.fecha && set.add(String(g.fecha).slice(0, 7)));
  return [...set].filter((m) => m <= hoy().slice(0, 7)).sort();
}

let mesResumenSel = null;
function vistaResumen() {
  const st = state;
  const meses = mesesConMovimiento(st);
  if (!mesResumenSel || !meses.includes(mesResumenSel)) mesResumenSel = [...meses].reverse().find((m) => st.ingresos.some((i) => i.mes === m)) || meses[meses.length - 1];
  const sel = mesResumenSel, i = meses.indexOf(sel);
  const ir = (m) => { mesResumenSel = m; render(); };
  const r = resumenMes(st, sel);
  const ult = meses.slice(-12).map((m) => resumenMes(st, m));
  const max = Math.max(1, ...ult.map((x) => Math.max(x.ingresos, x.gastos)));
  const conTasa = ult.filter((x) => x.tasa != null);
  const media = conTasa.length ? sum(conTasa, (x) => x.ahorro) / sum(conTasa, (x) => x.ingresos) : null;
  return [volver('#gastos', 'Gastos'),
    h('div', {class: 'mes-nav'},
      h('button', {class: 'redondo', type: 'button', 'aria-label': 'Mes anterior', disabled: i <= 0, onclick: () => ir(meses[i - 1])}, icono('atras')),
      h('span', {class: 'mes-nombre'}, mesLargo(sel)),
      h('button', {class: 'redondo', type: 'button', 'aria-label': 'Mes siguiente', disabled: i >= meses.length - 1, onclick: () => ir(meses[i + 1])}, icono('chevron'))),
    h('section', {class: 'heroe heroe-centro'},
      h('span', {class: 'heroe-lbl'}, r.ahorro >= 0 ? 'Has ahorrado' : 'Has gastado de más'),
      h('span', {class: 'heroe-num ' + (r.ahorro >= 0 ? '' : 'bad')}, eur2.format(Math.abs(r.ahorro))),
      r.tasa != null
        ? h('span', {class: 'heroe-sub'}, h('span', {class: 'pill ' + (r.tasa >= 0 ? 'pill-ok' : 'pill-bad')}, 'Tasa de ahorro ' + pct1.format(r.tasa)))
        : h('span', {class: 'heroe-sub'}, 'Apunta la nómina de ' + mesNombre(sel) + ' para ver tu tasa de ahorro')),
    h('div', {class: 'kpis'},
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Ingresos'), h('span', {class: 'kpi-num ok'}, eur0.format(r.ingresos))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Gastos'), h('span', {class: 'kpi-num'}, eur0.format(r.gastos))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Invertido'), h('span', {class: 'kpi-num'}, eur0.format(r.invertido)))),
    h('section', {class: 'card'},
      h('div', {class: 'card-cab'}, h('h2', null, 'Mes a mes'), media != null ? h('span', {class: 'sub'}, 'Media ' + pct0.format(media)) : null),
      h('div', {class: 'leyenda'}, h('span', null, h('span', {class: 'dot', style: 'background:var(--accent)'}), 'Ingresos'), h('span', null, h('span', {class: 'dot', style: 'background:var(--muted-bar)'}), 'Gastos')),
      h('div', {class: 'columnas dobles'}, ult.map((x) => h('button', {class: 'columna' + (x.m === sel ? ' activa' : ''), type: 'button', onclick: () => ir(x.m), 'aria-label': mesLargo(x.m)},
        h('span', {class: 'col-num ' + (x.tasa == null ? '' : x.tasa >= 0 ? 'ok' : 'bad')}, x.tasa == null ? '—' : pct0.format(x.tasa)),
        h('span', {class: 'col-par'},
          h('span', {class: 'b-ing', style: `height:${Math.max(2, x.ingresos / max * 100)}%`}),
          h('span', {class: 'b-gas', style: `height:${Math.max(2, Math.max(0, x.gastos) / max * 100)}%`})),
        h('span', {class: 'col-mes'}, mesNombre(x.m).slice(0, 3))))),
      h('p', {class: 'note'}, 'Tasa de ahorro = (ingresos − gastos) / ingresos del mes. Por encima del 20 % es un buen ritmo.'))];
}

function tarjetaAhorro() {
  const meses = mesesConMovimiento(state).filter((m) => state.ingresos.some((i) => i.mes === m));
  if (!meses.length) return null;
  const r = resumenMes(state, meses[meses.length - 1]);
  const ult = meses.slice(-6).map((m) => resumenMes(state, m));
  return h('a', {class: 'card card-enlace', href: '#resumen'},
    h('div', {class: 'card-cab'}, h('h2', null, 'Ahorro de ' + mesNombre(r.m)), icono('chevron', 'chev')),
    h('div', {class: 'fila-sep'},
      h('span', {class: 'num-m ' + (r.ahorro >= 0 ? '' : 'bad')}, eur2.format(r.ahorro)),
      h('span', {class: 'pill ' + (r.tasa >= 0 ? 'pill-ok' : 'pill-bad')}, pct1.format(r.tasa))),
    ult.length > 1 ? h('div', {class: 'mini-barras'}, ult.map((x) => h('span', {class: x.tasa >= 0 ? '' : 'neg', style: `height:${Math.max(8, Math.min(100, Math.abs(x.tasa) * 200))}%`, title: mesNombre(x.m) + ' ' + pct0.format(x.tasa)}))) : null,
    h('span', {class: 'sub'}, 'Ingresos ' + eur0.format(r.ingresos) + ' · gastos ' + eur0.format(r.gastos)));
}

/* ───────────────────────── Avisos ───────────────────────── */

function calcAvisos() {
  const st = state, out = [];
  const mesHoy = hoy().slice(0, 7);
  const gm = calcGastosMes(st, mesHoy);
  for (const r of gm.rows) {
    if (r.previsto > 0 && r.gastado >= r.previsto * 0.9) {
      out.push({ico: estiloCategoria(r.concepto).ico, color: r.gastado > r.previsto ? '#ff7a7a' : '#f5b14c', href: '#gastos',
        texto: r.gastado > r.previsto ? 'Te has pasado en ' + r.concepto : 'Llevas el ' + pct0.format(r.gastado / r.previsto) + ' de ' + r.concepto,
        detalle: eur0.format(r.gastado) + ' de ' + eur0.format(r.previsto)});
    }
  }
  const hist = st.historial.map((x) => x.fecha).sort();
  const ultimaFoto = hist[hist.length - 1];
  const dias = (f) => Math.floor((Date.now() - toDate(f).getTime()) / 864e5);
  if (st.saldos.length && (!ultimaFoto || dias(ultimaFoto) > 30)) {
    out.push({ico: 'saldos', color: '#94a3b8', href: '#saldos', texto: 'Actualiza tus saldos', detalle: ultimaFoto ? 'Hace ' + dias(ultimaFoto) + ' días de la última vez' : 'Aún no los has guardado'});
  }
  if (st.config.carteraEstimadaDesde && dias(st.config.carteraEstimadaDesde) > 25) {
    out.push({ico: 'inversion', color: '#76e78e', href: '#ajustar-cartera', texto: 'Ajusta la cartera con MyInvestor', detalle: 'Estimada desde el ' + fechaCorta(st.config.carteraEstimadaDesde)});
  }
  const rep = calcReparto(st, calcMesGastos(st));
  if (rep && !rep.cerrada && sum(rep.rows.filter((x) => !x.otra), (x) => x.pendiente) > 0) {
    out.push({ico: 'documento', color: '#7aa2ff', href: '#nominas', texto: 'Tienes la nómina de ' + mesNombre(rep.nomina) + ' sin repartir', detalle: 'Te falta mover ' + eur0.format(sum(rep.rows.filter((x) => !x.otra), (x) => x.pendiente))});
  }
  return out;
}
function tarjetaAvisos() {
  const avisos = calcAvisos();
  if (!avisos.length) return null;
  return h('section', {class: 'card avisos'},
    h('h2', null, 'Avisos'),
    h('ul', {class: 'lista'}, avisos.slice(0, 4).map((a) => h('li', null, h('a', {class: 'fila', href: a.href},
      h('span', {class: 'avatar sm', style: '--c:' + a.color}, icono(a.ico)),
      h('span', {class: 'fila-txt'}, h('span', null, a.texto), h('span', {class: 'e'}, a.detalle)),
      icono('chevron', 'chev'))))));
}

/* ───────────────────────── Impuestos si vendieras ───────────────────────── */

/* IRPF de la base del ahorro (tramos estatales + autonómicos según la normativa de 2025). */
const TRAMOS_AHORRO = [[6000, 0.19], [50000, 0.21], [200000, 0.23], [300000, 0.27], [Infinity, 0.30]];
function irpfAhorro(base) {
  let resto = Math.max(0, base), anterior = 0, total = 0;
  for (const [hasta, tipo] of TRAMOS_AHORRO) {
    const tramo = Math.min(resto, hasta - anterior);
    total += tramo * tipo; resto -= tramo; anterior = hasta;
    if (resto <= 0) break;
  }
  return total;
}
function tarjetaImpuestos(res) {
  if (!state.cartera.length) return null;
  const ganancia = res.ganancia, impuesto = irpfAhorro(ganancia);
  return h('section', {class: 'card'},
    h('h2', null, 'Si vendieras hoy'),
    h('div', {class: 'kpis dentro'},
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Ganancia'), h('span', {class: 'kpi-num ' + (ganancia >= 0 ? 'ok' : 'bad')}, signed(ganancia))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'IRPF aprox.'), h('span', {class: 'kpi-num'}, eur0.format(impuesto))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Te quedaría'), h('span', {class: 'kpi-num'}, eur0.format(res.fondos - impuesto)))),
    h('p', {class: 'note'}, 'Solo pagas al vender y por la ganancia, con los tramos del ahorro (19 % hasta 6.000 €, 21 % hasta 50.000 €…). Los traspasos entre fondos no tributan. Es una estimación: no tiene en cuenta otras ganancias o pérdidas del año.'));
}

/* ───────────────────────── Bienvenida para cuentas nuevas ───────────────────────── */

const PLANTILLAS_CUENTAS = [
  ['Cuenta corriente', 'Liquidez', 'Banco donde cobras la nómina', true],
  ['Cuenta remunerada', 'Cuenta remunerada', 'Trade Republic, Revolut…', false],
  ['Fondo de emergencia', 'Fondo de emergencia', 'Dinero apartado para imprevistos', false],
  ['Cartera de fondos', 'Inversión', 'MyInvestor, Indexa…', false],
  ['Efectivo en casa', 'Efectivo', '', false]
];
function vistaBienvenida() {
  const filas = PLANTILLAS_CUENTAS.map(([cuenta, grupo, ayuda, marcada]) => ({cuenta, grupo,
    chk: h('input', {type: 'checkbox', checked: marcada, 'aria-label': 'Tengo ' + cuenta}),
    entidad: h('input', {type: 'text', placeholder: ayuda || 'Entidad (opcional)', autocomplete: 'off', 'aria-label': 'Entidad de ' + cuenta}),
    saldo: h('input', {type: 'number', step: '0.01', inputmode: 'decimal', placeholder: '0', 'aria-label': 'Saldo de ' + cuenta})}));
  const nombre = h('input', {type: 'text', id: 'b-nombre', value: state.config.nombre || '', autocomplete: 'given-name'});
  const nomina = h('input', {type: 'number', step: '0.01', inputmode: 'decimal', id: 'b-nomina', placeholder: 'Ej. 1500'});
  const gasto = h('input', {type: 'number', step: '0.01', inputmode: 'decimal', id: 'b-gasto', placeholder: 'Ej. 1000'});
  filas.forEach((f) => f.saldo.addEventListener('input', () => { if (f.saldo.value) f.chk.checked = true; }));
  const form = h('form', {class: 'form'},
    h('h3', {class: 'paso'}, h('span', null, '1'), 'Tus cuentas'),
    h('ul', {class: 'lista'}, filas.map((f) => h('li', {class: 'bienv-cuenta'},
      h('label', {class: 'chk'}, f.chk, h('span', null, h('b', null, f.cuenta))),
      h('div', {class: 'row'}, f.entidad, h('span', {class: 'input-euro'}, f.saldo, '€'))))),
    h('h3', {class: 'paso'}, h('span', null, '2'), 'Tu nómina y tus gastos'),
    h('div', {class: 'row'},
      h('label', {class: 'f', for: 'b-nombre'}, 'Tu nombre', nombre),
      h('label', {class: 'f', for: 'b-nomina'}, 'Nómina al mes (€)', nomina),
      h('label', {class: 'f', for: 'b-gasto'}, 'Gastas al mes, más o menos (€)', gasto)),
    h('button', {class: 'btn pri ancho', type: 'submit'}, 'Empezar'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    for (const f of filas) {
      if (!f.chk.checked) continue;
      state.saldos.push({id: newId(), cuenta: f.cuenta, entidad: f.entidad.value.trim(), grupo: f.grupo, saldo: coerce({t: 'money'}, f.saldo.value)});
    }
    if (!state.saldos.length) return toast('Marca al menos una cuenta');
    state.config.nombre = nombre.value.trim();
    const n = coerce({t: 'money'}, nomina.value), g = coerce({t: 'money'}, gasto.value), mes = hoy().slice(0, 7);
    if (n > 0) state.ingresos.push({id: newId(), mes, concepto: 'Nómina', importe: n, cerrada: false});
    if (g > 0) for (const m of [mes, mesSiguiente(mes)]) state.presupuesto.push({id: newId(), mes: m, concepto: 'Gastos del mes', cantidad: 1, unidad: 'mes', precio: g, pendiente: false});
    fotoSaldos(hoy());
    save();
    location.hash = '#panel';
    toast('¡Listo! Ya puedes apuntar tus gastos con el botón +');
  });
  return [h('section', {class: 'heroe'},
      h('span', {class: 'heroe-lbl'}, 'Bienvenido a PatriApp'),
      h('span', {class: 'num-m'}, 'Vamos a configurarla en un minuto'),
      h('span', {class: 'heroe-sub'}, 'Marca las cuentas que tienes y escribe lo que hay en cada una. Todo se puede cambiar después.')),
    h('section', {class: 'card'}, form)];
}

/* ───────────────────────── Historial de versiones ───────────────────────── */

const COPIAS_KEY = 'patrimonio-copias';
/* Copia diaria en el propio dispositivo (últimos 7 días), además del historial en la nube. */
function guardarCopiaLocal() {
  try {
    const copias = JSON.parse(localStorage.getItem(COPIAS_KEY) || '[]');
    if (copias.length && copias[0].fecha === hoy()) return;
    if (!totalFilas(state)) return;
    copias.unshift({fecha: hoy(), creado: new Date().toISOString(), state});
    localStorage.setItem(COPIAS_KEY, JSON.stringify(copias.slice(0, 7)));
  } catch (e) { /* sin espacio: no pasa nada */ }
}
function copiasLocales() {
  try { return JSON.parse(localStorage.getItem(COPIAS_KEY) || '[]'); } catch (e) { return []; }
}

let versionesNube = null;   // null = sin cargar; {error} o {lista}
async function cargarVersiones() {
  if (!(typeof CONFIGURADO !== 'undefined' && CONFIGURADO && usuario)) { versionesNube = {lista: []}; return; }
  try {
    const {data, error} = await sb.from('datos_versiones').select('id, creado').eq('user_id', usuario.id).order('creado', {ascending: false}).limit(60);
    versionesNube = error ? {error: /does not exist|relation|schema cache|404/i.test(error.message || '') ? 'falta' : 'red'} : {lista: data || []};
  } catch (e) {
    versionesNube = {error: 'red'};
  }
  if (location.hash === '#versiones') render();
}
function resumenDatos(st) {
  const s = normalize(st);
  return eur0.format(sum(s.saldos, (r) => r.saldo)) + ' · ' + s.gastos.length + ' gastos';
}
async function restaurar(contenido, cuando) {
  const actual = resumenDatos(state), antes = resumenDatos(contenido);
  if (!(await confirmar('Ahora: ' + actual + '\nEntonces: ' + antes, {titulo: '¿Volver a como estaba el ' + cuando + '?', aceptar: 'Restaurar'}))) return;
  guardarCopiaLocal();
  state = normalize(contenido);
  save();
  location.hash = '#panel';
  toast('Datos restaurados');
}
function vistaVersiones() {
  if (versionesNube === null) { versionesNube = {cargando: true}; cargarVersiones(); }
  const fechaHora = (iso) => new Date(iso).toLocaleString('es-ES', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
  const out = [volver(),
    h('section', {class: 'heroe heroe-peq'},
      h('span', {class: 'heroe-lbl'}, 'Historial de versiones'),
      h('span', {class: 'num-m'}, 'Vuelve atrás si algo sale mal'),
      h('span', {class: 'heroe-sub'}, 'Se guarda una versión de tus datos cada hora que haces cambios. Al restaurar, lo de ahora también queda guardado.'))];
  const nube = versionesNube;
  if (typeof CONFIGURADO !== 'undefined' && CONFIGURADO) {
    out.push(h('section', {class: 'card'},
      h('div', {class: 'card-cab'}, h('h2', null, 'En tu cuenta'), h('button', {class: 'btn-txt', type: 'button', onclick: () => { versionesNube = null; render(); }}, 'Recargar')),
      nube.cargando ? h('div', {class: 'cargando'})
        : nube.error === 'falta' ? h('p', {class: 'empty'}, 'El historial en la nube aún no está activado. Hay que ejecutar una vez supabase/actualizacion-v8.sql en Supabase (te lo explico en el README).')
        : nube.error ? h('p', {class: 'empty'}, 'No se ha podido cargar. ¿Tienes conexión?')
        : nube.lista.length ? h('ul', {class: 'lista'}, nube.lista.map((v) => h('li', null, h('button', {class: 'fila', type: 'button', onclick: async () => {
            let data = null, error = null;
            try { ({data, error} = await sb.from('datos_versiones').select('contenido').eq('id', v.id).single()); } catch (e) { error = e; }
            if (error || !data) return toast('No se ha podido cargar esa versión');
            restaurar(data.contenido, fechaHora(v.creado));
          }},
            h('span', {class: 'avatar sm', style: '--c:#fbbf24'}, icono('reloj')),
            h('span', {class: 'fila-txt'}, h('span', null, fechaHora(v.creado))),
            icono('chevron', 'chev')))))
        : h('p', {class: 'empty'}, 'Todavía no hay versiones: aparecerán cuando hagas cambios.')));
  }
  const locales = copiasLocales();
  out.push(h('section', {class: 'card'},
    h('h2', null, 'En este dispositivo'),
    locales.length ? h('ul', {class: 'lista'}, locales.map((c) => h('li', null, h('button', {class: 'fila', type: 'button', onclick: () => restaurar(c.state, fechaLarga(c.fecha))},
      h('span', {class: 'avatar sm', style: '--c:#94a3b8'}, icono('copia')),
      h('span', {class: 'fila-txt'}, h('span', null, fechaLarga(c.fecha)), h('span', {class: 'e'}, resumenDatos(c.state))),
      icono('chevron', 'chev')))))
      : h('p', {class: 'empty'}, 'Se guarda una copia al día de los últimos 7 días.')));
  return out;
}

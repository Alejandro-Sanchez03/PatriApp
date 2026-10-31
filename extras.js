/* Objetivo FIRE e importación de movimientos del banco. */
'use strict';

/* ───────────────────────── Objetivo FIRE ───────────────────────── */

/* Gasto mensual medio de los últimos meses completos (o lo presupuestado si aún no hay meses cerrados). */
function gastoMensualMedio(st) {
  const mesHoy = hoy().slice(0, 7);
  const meses = [...new Set(st.gastos.map((g) => String(g.fecha).slice(0, 7)))].filter((m) => m < mesHoy).sort().slice(-6);
  if (meses.length) return sum(meses, (m) => sum(st.gastos.filter((g) => String(g.fecha).slice(0, 7) === m), (g) => g.importe)) / meses.length;
  return calcMesGastos(st).previsto;
}
/* Aportación mensual media: lo que mueves a ahorro e inversión con cada nómina. */
function aporteMensualMedio(st) {
  const porMes = {};
  st.movimientos.forEach((m) => { if (m.mes_nomina) porMes[m.mes_nomina] = (porMes[m.mes_nomina] || 0) + m.importe; });
  const v = Object.keys(porMes).sort().slice(-6).map((k) => porMes[k]);
  return v.length ? sum(v, (x) => x) / v.length : 0;
}

function calcFire(st) {
  const c = st.config;
  const gasto = c.fireGasto > 0 ? c.fireGasto : gastoMensualMedio(st);
  const tasa = c.fireTasa > 0 ? c.fireTasa : 4;
  const objetivo = gasto * 12 / (tasa / 100);
  const res = calcResumen(st);
  const ahorro = sum(st.saldos.filter((r) => r.grupo === 'Cuenta remunerada' || r.grupo === 'Fondo de emergencia'), (r) => r.saldo);
  const actual = c.fireBase === 'todo' ? res.patrimonio : res.inversion + ahorro;
  const aporte = c.fireAporte > 0 ? c.fireAporte : aporteMensualMedio(st);
  const rMes = Math.pow(1 + (c.fireRent || 0) / 100, 1 / 12) - 1;
  // Simulación mes a mes (máximo 60 años)
  let valor = actual, meses = 0;
  const serie = [{fecha: hoy(), valor}];
  const base = new Date();
  while (valor < objetivo && meses < 720) {
    valor = valor * (1 + rMes) + aporte;
    meses++;
    if (meses % 12 === 0) serie.push({fecha: new Date(base.getFullYear() + meses / 12, base.getMonth(), 1).toISOString().slice(0, 10), valor});
  }
  const alcanzable = objetivo > 0 && valor >= objetivo;
  const fechaMeta = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  if (alcanzable && meses % 12) serie.push({fecha: fechaMeta.toISOString().slice(0, 10), valor});
  return {gasto, tasa, objetivo, actual, aporte, progreso: objetivo ? Math.min(1, actual / objetivo) : 0, meses, alcanzable, fechaMeta, serie};
}

const textoAnios = (meses) => {
  const a = Math.floor(meses / 12), m = meses % 12;
  return (a ? a + (a === 1 ? ' año' : ' años') : '') + (a && m ? ' y ' : '') + (m ? m + (m === 1 ? ' mes' : ' meses') : '') || 'ya';
};

/* Tarjeta de Inicio */
function tarjetaFire() {
  const f = calcFire(state);
  if (!f.objetivo) return null;
  const edad = state.config.fireEdad > 0 ? state.config.fireEdad + Math.round(f.meses / 12) : 0;
  return h('a', {class: 'card card-enlace', href: '#fire'},
    h('div', {class: 'card-cab'}, h('h2', null, 'Libertad financiera'), icono('chevron', 'chev')),
    h('div', {class: 'fila-sep'},
      h('span', {class: 'num-m'}, pct0.format(f.progreso)),
      h('span', {class: 'sub'}, 'de ' + eur0.format(f.objetivo))),
    h('span', {class: 'track grueso'}, h('span', {class: 'fill', style: `width:${f.progreso * 100}%;background:linear-gradient(90deg, var(--accent-2), var(--accent))`})),
    h('span', {class: 'sub'}, f.progreso >= 1 ? '¡Objetivo alcanzado!' : f.alcanzable
      ? 'A tu ritmo llegarías en ' + textoAnios(f.meses) + ' (' + MESES[f.fechaMeta.getMonth()] + ' de ' + f.fechaMeta.getFullYear() + (edad ? ', con ' + edad + ' años' : '') + ')'
      : 'Con tu ritmo actual no se alcanza: revisa la aportación o la rentabilidad'));
}

function vistaFire() {
  const st = state, c = st.config;
  const f = calcFire(st);
  const edad = c.fireEdad > 0 ? c.fireEdad + Math.round(f.meses / 12) : 0;
  const campoNum = (k, label, ayuda, attrs) => h('label', {class: 'f', for: 'fire-' + k}, label,
    h('input', {id: 'fire-' + k, name: k, type: 'number', inputmode: 'decimal', step: 'any', min: '0', value: c[k] > 0 ? String(c[k]) : '', placeholder: ayuda, ...attrs}));
  const form = h('form', {class: 'form'},
    h('div', {class: 'row'},
      campoNum('fireGasto', 'Gasto al mes cuando te retires (€)', 'Auto: ' + eur0.format(gastoMensualMedio(st))),
      campoNum('fireAporte', 'Lo que inviertes al mes (€)', 'Auto: ' + eur0.format(aporteMensualMedio(st))),
      campoNum('fireRent', 'Rentabilidad anual esperada (%)', '5'),
      campoNum('fireTasa', 'Tasa de retirada (%)', '4'),
      campoNum('fireEdad', 'Tu edad (opcional)', '—', {step: '1'}),
      h('label', {class: 'f', for: 'fire-base'}, 'Qué cuenta como patrimonio',
        h('select', {id: 'fire-base', name: 'fireBase'},
          h('option', {value: 'inversion', selected: c.fireBase !== 'todo'}, 'Inversión y ahorro'),
          h('option', {value: 'todo', selected: c.fireBase === 'todo'}, 'Todo mi patrimonio')))),
    h('button', {class: 'btn pri ancho', type: 'submit'}, 'Recalcular'));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const e = form.elements, n = (x) => Math.max(0, Number(String(x).replace(',', '.')) || 0);
    state.config = {...state.config, fireGasto: n(e.fireGasto.value), fireAporte: n(e.fireAporte.value),
      fireRent: e.fireRent.value === '' ? 5 : n(e.fireRent.value), fireTasa: n(e.fireTasa.value) || 4, fireEdad: Math.round(n(e.fireEdad.value)), fireBase: e.fireBase.value};
    save(); render(); toast('Calculado');
  });

  return [
    h('section', {class: 'heroe'},
      h('span', {class: 'heroe-lbl'}, 'Tu número FIRE'),
      h('span', {class: 'heroe-num'}, eur0.format(f.objetivo)),
      h('span', {class: 'heroe-sub'}, 'Con ' + eur0.format(f.objetivo) + ' invertidos podrías retirar ' + eur0.format(f.gasto) + ' al mes (el ' + f.tasa.toLocaleString('es-ES') + ' % al año) sin quedarte sin dinero.'),
      h('span', {class: 'track grueso'}, h('span', {class: 'fill', style: `width:${f.progreso * 100}%;background:linear-gradient(90deg, var(--accent-2), var(--accent))`})),
      h('span', {class: 'heroe-sub'}, h('b', null, pct1.format(f.progreso)), ' · tienes ' + eur0.format(f.actual))),
    h('div', {class: 'kpis'},
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Te falta'), h('span', {class: 'kpi-num'}, eur0.format(Math.max(0, f.objetivo - f.actual)))),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, 'Tiempo'), h('span', {class: 'kpi-num'}, f.progreso >= 1 ? '¡Ya!' : f.alcanzable ? (f.meses / 12).toLocaleString('es-ES', {maximumFractionDigits: 1}) + ' años' : '—')),
      h('div', {class: 'kpi'}, h('span', {class: 'kpi-lbl'}, edad ? 'Con' : 'Fecha'), h('span', {class: 'kpi-num'}, f.alcanzable ? (edad ? edad + ' años' : String(f.fechaMeta.getFullYear())) : '—'))),
    f.serie.length > 1 ? h('section', {class: 'card'},
      h('h2', null, 'Proyección'),
      h('p', {class: 'note'}, 'Invirtiendo ' + eur0.format(f.aporte) + ' al mes con un ' + (c.fireRent || 0).toLocaleString('es-ES') + ' % anual. La línea discontinua es tu objetivo.'),
      graficoArea(f.serie, null, {meta: f.objetivo})) : null,
    h('section', {class: 'card'}, h('h2', null, 'Tus datos'), form,
      h('p', {class: 'note'}, 'Deja un campo vacío para que la app lo calcule con tus gastos y transferencias. Es una estimación orientativa, no una recomendación de inversión.'))
  ];
}

/* ───────────────────────── Importar movimientos del banco ───────────────────────── */

let importacion = null;   // {archivo, filas: [...]}

async function cargarLectorExcel() {
  if (window.XLSX) return;
  await new Promise((ok, ko) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/xlsx.full.min.js';
    sc.onload = ok;
    sc.onerror = () => ko(new Error('No se pudo cargar el lector de Excel. ¿Tienes conexión?'));
    document.head.append(sc);
  });
}

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function leerImporte(v) {
  if (typeof v === 'number') return v;
  let t = String(v || '').replace(/[€\s ]/g, '').replace(/EUR/i, '');
  if (!t) return NaN;
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  if (coma > -1 && punto > -1) t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (coma > -1) t = t.replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  return Number(t);
}

function leerFecha(v) {
  if (v instanceof Date && !isNaN(v)) {
    const d = new Date(v.getTime() + 12 * 3600e3);   // evita saltos de día por la zona horaria
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {   // número de serie de Excel
    return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  }
  const t = String(v || '').trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

/* Busca la fila de cabecera y las columnas de fecha, concepto e importe. */
function detectarColumnas(filas) {
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const cab = filas[i].map(sinTildes).map((x) => x.trim());
    const idx = (re, no) => cab.findIndex((x) => re.test(x) && !(no && no.test(x)));
    const fecha = [idx(/^fecha$/), idx(/fecha (de )?operacion|fecha contable|^date$/), idx(/^fecha|f\.? ?valor|valor/)].find((x) => x >= 0);
    const importe = idx(/importe|amount|cantidad|euros/, /disponible|saldo|divisa/);
    const cargo = idx(/^cargo|^debe|adeudo/), abono = idx(/^abono|^haber|ingreso/);
    if (fecha === undefined || (importe < 0 && (cargo < 0 || abono < 0))) continue;
    const textos = cab.map((x, j) => (/concepto|descrip|detalle|movimiento|beneficiario|comercio|observacion|referencia/.test(x) ? j : -1)).filter((j) => j >= 0);
    if (!textos.length) continue;
    return {cabecera: i, fecha, importe, cargo, abono, textos, cab};
  }
  return null;
}

/* Categoría sugerida: primero lo que ya has usado para conceptos parecidos, después palabras clave. */
const PALABRAS_VACIAS = new Set(['pago', 'compra', 'tarjeta', 'con', 'de', 'en', 'la', 'el', 'del', 'a', 'transferencia', 'recibida', 'recibido', 'enviado', 'enviada', 'adeudo', 'recibo', 'cargo', 'abono', 'sl', 'sa', 's.l.', 's.a.', 'es', 'esp', 'www', 'com']);
function claves(texto) {
  return sinTildes(texto).replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter((p) => p.length >= 3 && !PALABRAS_VACIAS.has(p) && !/^\d+$/.test(p));
}
function aprenderCategorias() {
  const mapa = {};
  for (const g of state.gastos) {
    for (const k of claves(g.concepto).slice(0, 2)) {
      mapa[k] = mapa[k] || {};
      mapa[k][g.categoria] = (mapa[k][g.categoria] || 0) + 1;
    }
  }
  return mapa;
}
const NOMBRE_POR_ICONO = {carrito: 'Supermercado', gasolina: 'Gasolina', cama: 'Alojamiento fuera', casa: 'Vivienda', comida: 'Restaurantes', repetir: 'Suscripciones', salud: 'Salud', deporte: 'Material deportivo', bolsa: 'Compras online', libro: 'Formación', flechas: 'Bizum', ocio: 'Ocio', coche: 'Coche'};
function sugerirCategoria(concepto, mapa) {
  for (const k of claves(concepto)) {
    const opciones = mapa[k];
    if (opciones) return Object.entries(opciones).sort((a, b) => b[1] - a[1])[0][0];
  }
  const e = estiloCategoria(concepto);
  if (e.ico === 'etiqueta') return 'Otros';
  const existente = categorias().find((cat) => estiloCategoria(cat).ico === e.ico);
  return existente || NOMBRE_POR_ICONO[e.ico] || 'Otros';
}

async function leerExtracto(archivo) {
  await cargarLectorExcel();
  let libro;
  if (/\.(csv|txt)$/i.test(archivo.name) || /csv|text\/plain/.test(archivo.type)) {
    // CSV: se lee como texto sin interpretar números (los bancos españoles usan «1.234,56»).
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    let texto = new TextDecoder('utf-8').decode(bytes);
    if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(bytes);
    libro = window.XLSX.read(texto.replace(/^\uFEFF/, ''), {type: 'string', raw: true});
  } else {
    libro = window.XLSX.read(await archivo.arrayBuffer(), {type: 'array', cellDates: true});
  }
  let filas = null, col = null;
  for (const nombre of libro.SheetNames) {
    const f = window.XLSX.utils.sheet_to_json(libro.Sheets[nombre], {header: 1, raw: true, defval: ''});
    const c = detectarColumnas(f);
    if (c) { filas = f; col = c; break; }
  }
  if (!col) throw new Error('No encuentro las columnas de fecha, concepto e importe en el archivo.');
  const mapa = aprenderCategorias();
  const cats = categorias();
  const bizumCat = cats.find((x) => /amigos|recibid/i.test(x)) || cats.find((x) => /bizum/i.test(x) && !/enviad/i.test(x)) || 'Partes de amigos (Bizum)';
  const out = [];
  for (const fila of filas.slice(col.cabecera + 1)) {
    const fecha = leerFecha(fila[col.fecha]);
    let importe = col.importe >= 0 ? leerImporte(fila[col.importe]) : (leerImporte(fila[col.abono]) || 0) - (leerImporte(fila[col.cargo]) || 0);
    if (!fecha || !Number.isFinite(importe) || importe === 0) continue;
    const partes = [...new Set(col.textos.map((j) => String(fila[j] || '').trim()).filter(Boolean))];
    const concepto = partes.join(' · ').replace(/\s+/g, ' ').slice(0, 120) || 'Movimiento';
    const t = sinTildes(concepto);
    const r = {id: newId(), fecha, concepto, banco: importe, incluir: true, tipo: 'gasto', categoria: '', nota: ''};
    if (importe < 0) {
      r.importe = round2(-importe);
      r.categoria = sugerirCategoria(concepto, mapa);
      if (/traspaso|trade republic|myinvestor|transferencia (realizada|emitida)|a cuenta propia|ahorro/.test(t)) { r.incluir = false; r.nota = 'Parece un movimiento entre tus cuentas'; r.categoria = 'Transferencia'; }
    } else if (/nomina|salario|haberes/.test(t)) {
      r.tipo = 'nomina'; r.importe = round2(importe); r.nota = 'Se apuntará como nómina';
    } else if (/bizum/.test(t)) {
      r.importe = round2(-importe); r.categoria = bizumCat; r.nota = 'Bizum recibido: resta de tus gastos';
    } else if (/devolucion|reembolso|abono de compra|anulacion/.test(t)) {
      r.importe = round2(-importe); r.categoria = sugerirCategoria(concepto, mapa); r.nota = 'Devolución: resta de tus gastos';
    } else {
      r.tipo = 'ingreso'; r.importe = round2(importe); r.incluir = false; r.nota = 'Ingreso: no es un gasto';
    }
    // ¿Ya apuntado? Misma fecha e importe.
    if (r.tipo === 'gasto' && state.gastos.some((g) => g.fecha === fecha && Math.abs(Math.abs(g.importe) - Math.abs(r.importe)) < 0.005)) { r.incluir = false; r.nota = 'Ya lo tienes apuntado'; }
    if (r.tipo === 'nomina' && state.ingresos.some((n) => n.mes === fecha.slice(0, 7))) { r.incluir = false; r.nota = 'Ya tienes la nómina de ese mes'; }
    out.push(r);
  }
  if (!out.length) throw new Error('El archivo no tiene movimientos que pueda leer.');
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

function vistaImportar() {
  const file = h('input', {type: 'file', accept: '.xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv', hidden: true});
  file.addEventListener('change', async () => {
    const a = file.files[0];
    if (!a) return;
    toast('Leyendo ' + a.name + '…');
    try {
      importacion = {archivo: a.name, filas: await leerExtracto(a)};
      render();
    } catch (e) {
      toast(e.message || 'No se pudo leer el archivo');
    } finally { file.value = ''; }
  });
  const volverG = volver('#gastos', 'Gastos');
  if (!importacion) {
    return [volverG,
      h('section', {class: 'heroe heroe-peq'},
        h('span', {class: 'heroe-lbl'}, 'Importar movimientos'),
        h('span', {class: 'num-m'}, 'Del Excel de tu banco'),
        h('span', {class: 'heroe-sub'}, 'Sube el extracto y PatriApp pondrá la categoría a cada gasto. Podrás revisarlos antes de añadirlos.'),
        h('button', {class: 'btn pri ancho', type: 'button', onclick: () => file.click()}, 'Elegir archivo'), file),
      h('section', {class: 'card'},
        h('h2', null, 'Cómo descargar el extracto'),
        h('ul', {class: 'pasos'},
          h('li', null, h('b', null, 'BBVA (web): '), 'Cuentas → tu cuenta → Movimientos → elige las fechas → icono de descarga → Excel.'),
          h('li', null, h('b', null, 'BBVA (app): '), 'tu cuenta → ⋯ → Descargar movimientos → Excel. Guárdalo en Archivos.'),
          h('li', null, h('b', null, 'Otros bancos: '), 'busca «Exportar» o «Descargar movimientos» en formato Excel (.xlsx) o CSV.')),
        h('p', {class: 'note'}, 'El archivo se lee en tu dispositivo: no se sube a ningún sitio. Los movimientos que ya tengas apuntados se detectan y no se duplican.'))];
  }

  const filas = importacion.filas;
  const resumen = h('span', {class: 'heroe-sub'});
  const boton = h('button', {class: 'btn pri ancho', type: 'button'});
  const actualizar = () => {
    const sel = filas.filter((r) => r.incluir);
    const g = sel.filter((r) => r.tipo === 'gasto');
    resumen.textContent = sel.length + ' de ' + filas.length + ' seleccionados · gastos ' + eur2.format(sum(g, (r) => r.importe));
    boton.textContent = sel.length ? 'Añadir ' + sel.length + (sel.length === 1 ? ' movimiento' : ' movimientos') : 'Nada seleccionado';
    boton.disabled = !sel.length;
  };
  boton.addEventListener('click', () => {
    let n = 0;
    for (const r of filas.filter((x) => x.incluir)) {
      if (r.tipo === 'nomina') state.ingresos.push({id: newId(), mes: r.fecha.slice(0, 7), concepto: 'Nómina', importe: r.importe, cerrada: false});
      else if (r.tipo === 'gasto') state.gastos.push({id: newId(), fecha: r.fecha, concepto: r.concepto, categoria: r.categoria || 'Otros', importe: r.importe});
      else continue;
      n++;
    }
    save();
    importacion = null;
    mesGastosSel = null;
    location.hash = '#gastos';
    toast(n + (n === 1 ? ' movimiento añadido' : ' movimientos añadidos'));
  });
  actualizar();

  return [volverG,
    h('section', {class: 'heroe heroe-peq'},
      h('span', {class: 'heroe-lbl'}, importacion.archivo),
      h('span', {class: 'num-m'}, 'Revisa y añade'),
      resumen, boton,
      h('button', {class: 'btn-txt', type: 'button', onclick: () => { importacion = null; render(); }}, 'Cancelar')),
    datalists(),
    h('section', {class: 'card'},
      h('ul', {class: 'lista'}, filas.map((r) => {
        const chk = h('input', {type: 'checkbox', checked: r.incluir, 'aria-label': 'Incluir ' + r.concepto});
        chk.addEventListener('change', () => { r.incluir = chk.checked; li.classList.toggle('apagada', !r.incluir); actualizar(); });
        const cat = r.tipo === 'gasto' ? h('input', {type: 'text', class: 'cat-input', value: r.categoria, list: 'dl-categorias', 'aria-label': 'Categoría'}) : null;
        if (cat) cat.addEventListener('change', () => { r.categoria = cat.value.trim(); });
        const li = h('li', {class: 'fila-imp-mov' + (r.incluir ? '' : ' apagada')},
          h('label', {class: 'imp-chk'}, chk),
          r.tipo === 'gasto' ? avatarCategoria(r.categoria) : avatarGrupo(r.tipo === 'nomina' ? 'Liquidez' : 'Otros'),
          h('span', {class: 'fila-txt'},
            h('span', {class: 'multilinea'}, r.concepto),
            h('span', {class: 'e'}, fechaCorta(r.fecha) + (r.nota ? ' · ' + r.nota : '')),
            cat),
          h('span', {class: 'fila-imp ' + (r.banco > 0 ? 'ok' : '')}, (r.banco > 0 ? '+' : '−') + eur2.format(Math.abs(r.banco))));
        return li;
      })))];
}

/* ───────────────────────── Transferencias y cartera estimada ───────────────────────── */

/* Cuenta de saldos que representa el valor de los fondos. */
function cuentaCartera() {
  const inv = state.saldos.filter((r) => r.grupo === 'Inversión');
  return inv.find((r) => /^cartera indexada$/i.test(r.cuenta.trim())) || inv.find((r) => !/por invertir/i.test(r.cuenta)) || null;
}
function sincronizarSaldoCartera() {
  const c = cuentaCartera();
  if (c && state.cartera.length) c.saldo = round2(sum(state.cartera, (r) => r.valor));
}

/* Reparte una aportación entre los fondos según su peso actual (como hace la cartera gestionada). */
function repartirEnFondos(importe) {
  const fondos = state.cartera.filter((f) => f.valor > 0 && f.participaciones > 0);
  const total = sum(fondos, (f) => f.valor);
  if (!total) return false;
  for (const f of fondos) {
    const parte = importe * f.valor / total;
    const precio = f.valor / f.participaciones;          // € por participación
    f.participaciones = Math.round((f.participaciones + parte / precio) * 1e4) / 1e4;
    f.valor = round2(f.valor + parte);
    f.invertido = round2(f.invertido + parte);
  }
  if (!state.config.carteraEstimadaDesde) state.config.carteraEstimadaDesde = hoy();
  return true;
}

/* Mueve el dinero de una transferencia: sale de la cuenta corriente y entra en el destino. */
function aplicarTransferencia(m) {
  const x = Number(m.importe) || 0;
  if (x <= 0) return '';
  const origen = state.saldos.find((r) => r.grupo === 'Liquidez');
  if (origen) origen.saldo = round2(origen.saldo - x);
  let destino = '';
  if (m.destino === DESTINOS[1]) {
    if (repartirEnFondos(x)) { sincronizarSaldoCartera(); destino = 'repartido entre tus fondos'; }
    else { const c = cuentaCartera(); if (c) { c.saldo = round2(c.saldo + x); destino = 'sumado a ' + c.cuenta; } }
  } else {
    const grupo = m.destino === DESTINOS[0] ? 'Cuenta remunerada' : m.destino === 'Fondo de emergencia' ? 'Fondo de emergencia' : null;
    const c = grupo && state.saldos.find((r) => r.grupo === grupo);
    if (c) { c.saldo = round2(c.saldo + x); destino = 'sumado a ' + (c.entidad || c.cuenta); }
  }
  fotoSaldos(hoy());
  return destino;
}

/* Pantalla para corregir la cartera con los datos reales de MyInvestor. */
let modoAjuste = 'total';
function vistaAjustarCartera() {
  const fondos = state.cartera.slice().sort((a, b) => b.valor - a.valor);
  const res = calcResumen(state);
  const porInv = state.saldos.find((r) => r.grupo === 'Inversión' && /por invertir/i.test(r.cuenta));
  const terminar = (msg) => {
    delete state.config.carteraEstimadaDesde;
    state.config.carteraAjustada = hoy();
    sincronizarSaldoCartera();
    fotoSaldos(hoy());
    save();
    location.hash = '#inversion';
    toast(msg);
  };
  const opcion = (k, t) => h('button', {class: 'seg' + (modoAjuste === k ? ' activo' : ''), type: 'button', onclick: () => { modoAjuste = k; render(); }}, t);
  const out = [volver('#inversion', 'Inversión'),
    h('section', {class: 'card'},
      h('h2', null, 'Ajustar con MyInvestor'),
      h('p', {class: 'note'}, 'Copia los datos de la app de MyInvestor. Lo más rápido es el valor total; si quieres el detalle exacto, pon las participaciones de cada fondo.'),
      h('div', {class: 'segmentos', style: 'grid-template-columns:1fr 1fr'}, opcion('total', 'Valor total'), opcion('fondos', 'Por fondo')))];

  if (modoAjuste === 'total') {
    const total = h('input', {type: 'number', step: '0.01', inputmode: 'decimal', id: 'aj-total', value: String(round2(res.fondos)), required: true});
    const efectivo = porInv ? h('input', {type: 'number', step: '0.01', inputmode: 'decimal', id: 'aj-efe', value: String(porInv.saldo)}) : null;
    const form = h('form', {class: 'form'},
      h('label', {class: 'f', for: 'aj-total'}, 'Valor de los fondos según MyInvestor (€)', total),
      efectivo ? h('label', {class: 'f', for: 'aj-efe'}, 'Efectivo por invertir (€)', efectivo) : null,
      h('button', {class: 'btn pri ancho', type: 'submit'}, 'Ajustar'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const nuevo = coerce({t: 'money'}, total.value), antes = res.fondos;
      if (!(nuevo > 0) || !antes) return toast('Pon un valor mayor que 0');
      const k = nuevo / antes;
      // Mismo reparto entre fondos; cambia el número de participaciones en la misma proporción.
      state.cartera.forEach((f) => { f.participaciones = Math.round(f.participaciones * k * 1e4) / 1e4; f.valor = round2(f.valor * k); });
      // El redondeo de céntimos se ajusta en el fondo más grande para que el total cuadre exacto.
      const mayor = state.cartera.reduce((m, f) => (f.valor > m.valor ? f : m), state.cartera[0]);
      if (mayor) mayor.valor = round2(mayor.valor + nuevo - sum(state.cartera, (f) => f.valor));
      if (efectivo && porInv) porInv.saldo = coerce({t: 'money'}, efectivo.value);
      terminar('Cartera ajustada: ' + signed(nuevo - antes));
    });
    out.push(h('section', {class: 'card'}, form,
      h('p', {class: 'note'}, 'Lo aportado no cambia. Si en MyInvestor ves el importe invertido de cada fondo, usa «Por fondo».')));
  } else {
    const filas = fondos.map((f) => ({f,
      part: h('input', {type: 'number', step: 'any', inputmode: 'decimal', value: String(f.participaciones), 'aria-label': 'Participaciones de ' + f.fondo}),
      inv: h('input', {type: 'number', step: '0.01', inputmode: 'decimal', value: String(f.invertido), 'aria-label': 'Invertido en ' + f.fondo})}));
    const form = h('form', {class: 'form'},
      h('ul', {class: 'lista'}, filas.map(({f, part, inv}) => h('li', {class: 'ajuste-fondo'},
        h('span', {class: 'multilinea'}, f.fondo),
        h('label', {class: 'f'}, 'Participaciones', part),
        h('label', {class: 'f'}, 'Invertido (€)', inv)))),
      h('button', {class: 'btn pri ancho', type: 'submit'}, 'Guardar'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const antes = res.fondos;
      for (const {f, part, inv} of filas) {
        const p = coerce({t: 'number'}, part.value);
        const precio = f.participaciones > 0 ? f.valor / f.participaciones : 0;
        if (p >= 0 && precio) { f.valor = round2(p * precio); f.participaciones = p; }
        const i = coerce({t: 'money'}, inv.value);
        if (i >= 0) f.invertido = i;
      }
      terminar('Cartera ajustada: ' + signed(sum(state.cartera, (r) => r.valor) - antes));
    });
    out.push(h('section', {class: 'card'}, form));
  }
  return out;
}

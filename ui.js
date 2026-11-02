/* Piezas visuales de PatriApp: iconos, hojas inferiores, confirmaciones, colores de categoría y gráfico de área. */
'use strict';

/* Iconos de trazo (24×24). Son constantes propias: nunca contienen datos del usuario. */
const ICONOS = {
  inicio: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h4.5v-6h4v6h4.5V9"/>',
  gastos: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 9.5h18"/><path d="M7 14.5h4"/>',
  inversion: '<path d="M3.5 17 9 11.5l4 4 7.5-7.5"/><path d="M15 8h5.5v5.5"/>',
  saldos: '<path d="M12 3.5 3.5 8h17L12 3.5z"/><path d="M5.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M18.5 10.5v6.5"/><path d="M3.5 20.5h17"/>',
  ajustes: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  atras: '<path d="m14.5 6-6 6 6 6"/>',
  nube: '<path d="M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.8 5.8 0 0 0 6.4 9.6 4.5 4.5 0 0 0 7.5 18.5z"/>',
  sinNube: '<path d="M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.8 5.8 0 0 0 6.4 9.6 4.5 4.5 0 0 0 7.5 18.5z"/><path d="m4 4 16 16"/>',
  carrito: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3.5 4.5h2.2l2.2 10.3a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.4"/>',
  gasolina: '<path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20"/><path d="M4 20h11"/><path d="M5 10h9"/><path d="m14 8.5 3 3v5.5a1.5 1.5 0 0 0 3 0V9.5L17.5 7"/>',
  casa: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5h4v5"/>',
  cama: '<path d="M3.5 18.5v-11"/><path d="M3.5 14.5h17v4"/><path d="M20.5 14.5V12a2.5 2.5 0 0 0-2.5-2.5h-7v5"/><circle cx="7.3" cy="11.5" r="1.8"/>',
  comida: '<path d="M7 3.5v17"/><path d="M4.5 3.5v5a2.5 2.5 0 0 0 5 0v-5"/><path d="M17 20.5V3.5c-2.2 0-3.5 2.4-3.5 5.5v4.5H17"/>',
  ocio: '<path d="M4 7.5a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2.5a2 2 0 0 0 0 4v2.5a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2V14a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="1.5 2.2"/>',
  repetir: '<path d="m16.5 3 3 3-3 3"/><path d="M4.5 11V9.5A3.5 3.5 0 0 1 8 6h11.5"/><path d="m7.5 21-3-3 3-3"/><path d="M19.5 13v1.5A3.5 3.5 0 0 1 16 18H4.5"/>',
  salud: '<path d="M12 20s-7.5-4.6-9-9.4A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 9 3.2C19.5 15.4 12 20 12 20z"/>',
  deporte: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  bolsa: '<path d="M5 8.5h14l-1.1 11.5H6.1L5 8.5z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  libro: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v15h-13a2 2 0 0 0-2 2v-15z"/><path d="M4.5 20.5a2 2 0 0 1 2-2h13v2h-13"/>',
  flechas: '<path d="M6.5 7.5h13l-3-3"/><path d="M17.5 16.5h-13l3 3"/>',
  etiqueta: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7-8.3-8.3z"/><circle cx="8" cy="8" r="1.4"/>',
  usuario: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  documento: '<path d="M6.5 3.5h7.5l4 4v13h-11.5z"/><path d="M14 3.5v4h4"/><path d="M9.5 12.5h5M9.5 16h5"/>',
  tarta: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z"/><path d="M15 3.9A8.5 8.5 0 0 1 20.1 9H15z"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  copia: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 16.5v3h15v-3"/>',
  luna: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  regla: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  banco: '<path d="M12 3.5 3.5 8h17L12 3.5z"/><path d="M5.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M18.5 10.5v6.5"/><path d="M3.5 20.5h17"/>',
  hucha: '<path d="M5 11.5a6.5 5.5 0 0 1 12.2-2.6l2.3-.9v3.5l1 .5v3l-1.8.6a6.6 6.6 0 0 1-2.7 2.6V20h-2.5v-1.2a7.6 7.6 0 0 1-3 0V20H8v-1.8A5.6 5.6 0 0 1 5 11.5z"/><circle cx="15" cy="11" r=".6"/>',
  coche: '<path d="M4.5 16.5v-4l2-5h11l2 5v4z"/><path d="M4.5 16.5V19h2.5v-2.5M17 16.5V19h2.5v-2.5"/><circle cx="8" cy="13.5" r="1"/><circle cx="16" cy="13.5" r="1"/>',
  escudo: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/>',
  billete: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  campana: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'
};

function icono(nombre, clase) {
  const el = document.createElementNS(SVGNS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('class', 'ico-svg' + (clase ? ' ' + clase : ''));
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = ICONOS[nombre] || ICONOS.etiqueta;
  return el;
}

/* Icono y color de cada categoría de gasto, por palabras clave. */
const CATEGORIAS_ESTILO = [
  [/super|mercadona|lidl|carrefour|aliment/i, 'carrito', '#4cc38a'],
  [/gasolin|combustib|diesel/i, 'gasolina', '#f5a524'],
  [/alojamiento|hotel|booking/i, 'cama', '#a78bfa'],
  [/apartamento|alquiler|hipoteca|vivienda|piso|casa/i, 'casa', '#7aa2ff'],
  [/restaurante|comida fuera|bar|cafeter|cena/i, 'comida', '#ff8a65'],
  [/suscrip|netflix|spotify|hbo|disney|prime video|icloud|apple\.com|youtube premium/i, 'repetir', '#22d3ee'],
  [/fisio|salud|m[eé]dic|farmacia|dentista/i, 'salud', '#fb7185'],
  [/deport|gimnasio|material/i, 'deporte', '#34d399'],
  [/compras|amazon|online|ropa|wallapop/i, 'bolsa', '#fbbf24'],
  [/academia|curso|libro|formaci|oposici/i, 'libro', '#60a5fa'],
  [/bizum|amigos|transfer/i, 'flechas', '#94a3b8'],
  [/ocio|cine|viaje|fiesta|concierto/i, 'ocio', '#f472b6'],
  [/coche|seguro|taller|itv/i, 'coche', '#f59e0b']
];
function estiloCategoria(nombre) {
  for (const [re, ico, color] of CATEGORIAS_ESTILO) if (re.test(nombre || '')) return {ico, color};
  return {ico: 'etiqueta', color: '#8aa397'};
}
function avatarCategoria(nombre) {
  const e = estiloCategoria(nombre);
  return h('span', {class: 'avatar', style: '--c:' + e.color}, icono(e.ico));
}

/* Color e icono de cada grupo de cuentas. */
const GRUPOS_ESTILO = {
  'Liquidez': ['banco', '#94a3b8'], 'Efectivo': ['billete', '#cbd5e1'], 'Apartado para el coche': ['coche', '#f5a524'],
  'Fondo de emergencia': ['escudo', '#fbbf24'], 'Cuenta remunerada': ['hucha', '#22d3ee'], 'Inversión': ['inversion', '#76e78e'], 'Otros': ['etiqueta', '#8aa397']
};
const estiloGrupo = (g) => GRUPOS_ESTILO[g] || GRUPOS_ESTILO.Otros;
function avatarGrupo(grupo) {
  const [ico, color] = estiloGrupo(grupo);
  return h('span', {class: 'avatar', style: '--c:' + color}, icono(ico));
}

/* ───────────── Hojas inferiores y confirmaciones (en lugar de las alertas del navegador) ───────────── */

function abrirHoja() {
  const dlg = document.getElementById('dialogo');
  if (!dlg.open) dlg.showModal();
}
function cerrarHoja() {
  const dlg = document.getElementById('dialogo');
  if (dlg.open) dlg.close();
}
document.addEventListener('DOMContentLoaded', () => {
  const dlg = document.getElementById('dialogo');
  // Tocar fuera de la hoja la cierra.
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
});

function confirmar(texto, {titulo, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false} = {}) {
  return new Promise((resolve) => {
    const dlg = document.getElementById('dialogo');
    const form = document.getElementById('dialogo-form');
    let hecho = false;
    const fin = (v) => { if (hecho) return; hecho = true; dlg.onclose = null; if (dlg.open) dlg.close(); resolve(v); };
    form.replaceChildren(...[
      h('div', {class: 'asa', 'aria-hidden': 'true'}),
      titulo ? h('h3', null, titulo) : null,
      h('p', {class: 'hoja-texto'}, texto),
      h('div', {class: 'hoja-btns'},
        h('button', {class: 'btn ' + (peligro ? 'pel' : 'pri') + ' ancho', type: 'button', onclick: () => fin(true)}, aceptar),
        h('button', {class: 'btn ancho', type: 'button', onclick: () => fin(false)}, cancelar))].filter(Boolean));
    form.onsubmit = (e) => e.preventDefault();
    dlg.onclose = null;
    abrirHoja();
    // Se escucha el cierre en el siguiente ciclo, para no recoger el cierre de una hoja anterior.
    setTimeout(() => { if (!hecho) dlg.onclose = () => fin(false); }, 0);
  });
}

/* ───────────── Gráfico de área de la evolución ───────────── */

/* puntos: [{fecha, valor}] ordenados. alMover(p | null) se llama al deslizar el dedo por el gráfico. */
function graficoArea(puntos, alMover, {meta} = {}) {
  const wrap = h('div', {class: 'area'});
  const W = Math.max(280, (document.getElementById('vista').clientWidth || 360) - 8), H = 150, pad = 6;
  const vals = puntos.map((p) => p.valor);
  if (meta) vals.push(meta);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (meta) min = Math.min(min, 0);
  if (max - min < 1) { min -= 50; max += 50; }
  const margen = (max - min) * 0.15;
  min -= margen; max += margen;
  const t0 = toDate(puntos[0].fecha).getTime(), t1 = toDate(puntos[puntos.length - 1].fecha).getTime();
  const x = (p, i) => (t1 > t0 ? (toDate(p.fecha).getTime() - t0) / (t1 - t0) : i / Math.max(1, puntos.length - 1)) * (W - pad * 2) + pad;
  const y = (v) => H - pad - (v - min) / (max - min) * (H - pad * 2);
  const xy = puntos.map((p, i) => [x(p, i), y(p.valor)]);
  // Curva suave entre puntos
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1], [x1, y1] = xy[i], cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const subeOBaja = puntos[puntos.length - 1].valor >= puntos[0].valor ? css('--accent') : css('--bad');
  const id = 'grad' + Math.random().toString(36).slice(2, 7);
  const svg = s('svg', {viewBox: `0 0 ${W} ${H}`, class: 'area-svg', role: 'img', 'aria-label': 'Evolución del patrimonio'});
  const defs = s('defs');
  const grad = s('linearGradient', {id, x1: '0', y1: '0', x2: '0', y2: '1'});
  grad.append(s('stop', {offset: '0%', 'stop-color': subeOBaja, 'stop-opacity': '.32'}), s('stop', {offset: '100%', 'stop-color': subeOBaja, 'stop-opacity': '0'}));
  defs.append(grad);
  svg.append(defs,
    s('path', {d: d + ` L${xy[xy.length - 1][0]},${H} L${xy[0][0]},${H} Z`, fill: `url(#${id})`}),
    s('path', {d, fill: 'none', stroke: subeOBaja, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'area-linea'}));
  if (meta) {
    svg.append(s('line', {x1: '0', x2: String(W), y1: y(meta), y2: y(meta), stroke: css('--warn'), 'stroke-width': '1.5', 'stroke-dasharray': '6 5'}),
      s('text', {x: String(W - 6), y: String(y(meta) - 6), 'text-anchor': 'end', fill: css('--warn'), 'font-size': '12', 'font-weight': '600'}, 'Objetivo ' + eur0.format(meta)));
  }
  const guia = s('line', {y1: '0', y2: String(H), stroke: css('--muted'), 'stroke-width': '1', 'stroke-dasharray': '3 3', opacity: '0'});
  const punto = s('circle', {r: '5', fill: subeOBaja, stroke: css('--bg'), 'stroke-width': '2', opacity: '0'});
  const ultimo = xy[xy.length - 1];
  svg.append(guia, punto, s('circle', {cx: ultimo[0], cy: ultimo[1], r: '4', fill: subeOBaja}));
  const mover = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * W;
    let i = 0;
    xy.forEach(([xx], j) => { if (Math.abs(xx - px) < Math.abs(xy[i][0] - px)) i = j; });
    guia.setAttribute('x1', xy[i][0]); guia.setAttribute('x2', xy[i][0]); guia.setAttribute('opacity', '1');
    punto.setAttribute('cx', xy[i][0]); punto.setAttribute('cy', xy[i][1]); punto.setAttribute('opacity', '1');
    if (alMover) alMover(puntos[i]);
  };
  const salir = () => { guia.setAttribute('opacity', '0'); punto.setAttribute('opacity', '0'); if (alMover) alMover(null); };
  svg.addEventListener('pointerdown', mover);
  svg.addEventListener('pointermove', mover);
  svg.addEventListener('pointerleave', salir);
  svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') salir(); });
  wrap.append(svg);
  return wrap;
}

/* Animación de la cifra grande al entrar en Inicio. */
function animarNumero(el, hasta, fmt) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const desde = hasta * 0.92, t0 = performance.now(), dur = 650;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(desde + (hasta - desde) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

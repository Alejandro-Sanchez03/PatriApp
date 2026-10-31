/* Cuenta, sesión, bloqueo con código y sincronización con Supabase.
 * Si config.js no tiene los datos de Supabase, la app funciona sin cuenta (solo en este dispositivo). */
'use strict';

const CFG = window.PATRIMONIO_CONFIG || {};
const CONFIGURADO = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.supabase.createClient);
const PREF_RECORDAR = 'patrimonio-recordar';
const PREF_EMAIL = 'patrimonio-email';
const PIN_KEY = 'patrimonio-pin';
const PIN_FALLOS = 'patrimonio-pin-fallos';
const CACHE_PREFIJO = 'patrimonio-cache:';
const BLOQUEO_TRAS_MS = 60 * 1000;   // pedir el código si la app estuvo en segundo plano más de 1 minuto
const MAX_FALLOS_PIN = 5;

let sb = null;        // cliente de Supabase
let usuario = null;   // {id, email}
const nube = {actualizado: null, pendiente: false, estado: 'local', version: 0, subiendo: false};
window.pantallaCuenta = null;

/* Enlaces de los emails (recuperar contraseña, invitación, confirmar cuenta) llegan con datos en el #. */
const hashInicial = new URLSearchParams(location.hash.replace(/^#/, ''));
const tipoEnlace = hashInicial.get('type');
const errorEnlace = hashInicial.get('error_description');
const urlApp = () => location.origin + location.pathname;

const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
};
const recordar = () => ls.get(PREF_RECORDAR) !== 'no';

/* Con «Recordar sesión» la sesión se guarda en localStorage; si no, en sessionStorage (se pierde al cerrar la app). */
const almacenSesion = {
  getItem: (k) => { try { return (recordar() ? localStorage : sessionStorage).getItem(k); } catch (e) { return null; } },
  setItem: (k, v) => { try { (recordar() ? localStorage : sessionStorage).setItem(k, v); } catch (e) { /* nada */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* nada */ } }
};

function traducirError(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/Invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Todavía no has confirmado tu email. Revisa tu correo (y la carpeta de spam).';
  if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese email. Inicia sesión.';
  if (/Password should be at least|at least \d+ characters/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.';
  if (/Signups not allowed|signup.*disabled/i.test(m)) return 'El registro está cerrado. Pide a quien gestiona la app que te invite.';
  if (/same.*password|different from the old/i.test(m)) return 'La nueva contraseña debe ser distinta de la anterior.';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Sin conexión. Comprueba internet y vuelve a probar.';
  return m || 'Algo ha fallado. Vuelve a probar.';
}

/* ───────────────────────── Pantallas ───────────────────────── */

function mostrar(fn) { window.pantallaCuenta = fn; render(); }
function salirDePantalla() { window.pantallaCuenta = null; render(); }

function tarjeta(titulo, aviso, ...contenido) {
  return h('section', {class: 'card acceso'},
    h('div', {class: 'acceso-logo'}, h('img', {src: 'icon-192.png', alt: 'PatriApp', width: '72', height: '72'})),
    h('h2', null, titulo),
    aviso ? h('p', {class: 'aviso ' + (aviso.tipo || ''), role: aviso.tipo === 'bad' ? 'alert' : 'status'}, aviso.texto) : null,
    contenido);
}

/* Envía un formulario con el botón desactivado mientras espera. */
function alEnviar(form, fn) {
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('button[type=submit]');
    const texto = btn.textContent;
    btn.disabled = true; btn.textContent = 'Un momento…';
    try { await fn(form.elements); } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = texto; } }
  });
}

const campoEmail = (valor) => h('label', {class: 'f'}, 'Email', h('input', {type: 'email', name: 'email', autocomplete: 'username', required: true, value: valor || ls.get(PREF_EMAIL) || ''}));
const campoPass = (name, label, nueva) => h('label', {class: 'f'}, label, h('input', {type: 'password', name, required: true, minlength: nueva ? '8' : null, autocomplete: nueva ? 'new-password' : 'current-password'}));
const enlace = (texto, fn) => h('button', {class: 'enlace', type: 'button', onclick: fn}, texto);

function pantallaLogin(aviso) {
  return () => {
    const form = h('form', {class: 'form'},
      campoEmail(),
      campoPass('pass', 'Contraseña'),
      h('label', {class: 'chk'}, h('input', {type: 'checkbox', name: 'recordar', checked: recordar()}), 'Recordar sesión en este dispositivo'),
      h('div', {class: 'btns'}, h('button', {class: 'btn pri ancho', type: 'submit'}, 'Entrar')));
    alEnviar(form, async (e) => {
      ls.set(PREF_RECORDAR, e.recordar.checked ? 'si' : 'no');
      ls.set(PREF_EMAIL, e.email.value.trim());
      const {data, error} = await sb.auth.signInWithPassword({email: e.email.value.trim(), password: e.pass.value});
      if (error) return mostrar(pantallaLogin({texto: traducirError(error), tipo: 'bad'}));
      await entrar(data.user, {recienEntrado: true});
    });
    return tarjeta('Iniciar sesión', aviso, form,
      h('div', {class: 'acceso-enlaces'},
        enlace('¿Has olvidado la contraseña?', () => mostrar(pantallaRecuperar())),
        CFG.registroAbierto !== false ? enlace('Crear una cuenta', () => mostrar(pantallaRegistro())) : null));
  };
}

function pantallaRegistro(aviso) {
  return () => {
    const form = h('form', {class: 'form'},
      campoEmail(''),
      campoPass('pass', 'Contraseña (mínimo 8 caracteres)', true),
      campoPass('pass2', 'Repite la contraseña', true),
      h('div', {class: 'btns'}, h('button', {class: 'btn pri ancho', type: 'submit'}, 'Crear cuenta')));
    alEnviar(form, async (e) => {
      if (e.pass.value !== e.pass2.value) return mostrar(pantallaRegistro({texto: 'Las contraseñas no coinciden.', tipo: 'bad'}));
      ls.set(PREF_EMAIL, e.email.value.trim());
      const {data, error} = await sb.auth.signUp({email: e.email.value.trim(), password: e.pass.value, options: {emailRedirectTo: urlApp()}});
      if (error) return mostrar(pantallaRegistro({texto: traducirError(error), tipo: 'bad'}));
      if (data.session) return entrar(data.user, {recienEntrado: true});
      mostrar(pantallaLogin({texto: 'Te hemos enviado un email para confirmar la cuenta. Ábrelo, pulsa el enlace y luego inicia sesión aquí.', tipo: 'ok'}));
    });
    return tarjeta('Crear una cuenta', aviso, form,
      h('p', {class: 'note'}, 'Cada persona tiene sus propios datos: nadie más puede verlos.'),
      h('div', {class: 'acceso-enlaces'}, enlace('Ya tengo cuenta', () => mostrar(pantallaLogin()))));
  };
}

function pantallaRecuperar(aviso) {
  return () => {
    const form = h('form', {class: 'form'},
      campoEmail(),
      h('div', {class: 'btns'}, h('button', {class: 'btn pri ancho', type: 'submit'}, 'Enviarme un enlace')));
    alEnviar(form, async (e) => {
      const {error} = await sb.auth.resetPasswordForEmail(e.email.value.trim(), {redirectTo: urlApp()});
      if (error) return mostrar(pantallaRecuperar({texto: traducirError(error), tipo: 'bad'}));
      mostrar(pantallaLogin({texto: 'Si existe una cuenta con ese email, te llegará un enlace para poner una contraseña nueva. Ábrelo en este mismo dispositivo.', tipo: 'ok'}));
    });
    return tarjeta('Recuperar la contraseña', aviso, form,
      h('div', {class: 'acceso-enlaces'}, enlace('Volver', () => mostrar(pantallaLogin()))));
  };
}

/* Tras abrir el enlace de recuperación o de invitación: elegir contraseña. */
function pantallaNuevaPass(tipo, aviso) {
  return () => {
    const form = h('form', {class: 'form'},
      campoPass('pass', 'Nueva contraseña (mínimo 8 caracteres)', true),
      campoPass('pass2', 'Repite la contraseña', true),
      h('div', {class: 'btns'}, h('button', {class: 'btn pri ancho', type: 'submit'}, 'Guardar contraseña')));
    alEnviar(form, async (e) => {
      if (e.pass.value !== e.pass2.value) return mostrar(pantallaNuevaPass(tipo, {texto: 'Las contraseñas no coinciden.', tipo: 'bad'}));
      const {data, error} = await sb.auth.updateUser({password: e.pass.value});
      if (error) return mostrar(pantallaNuevaPass(tipo, {texto: traducirError(error), tipo: 'bad'}));
      toast('Contraseña guardada');
      await entrar(data.user, {recienEntrado: true});
    });
    return tarjeta(tipo === 'invite' ? 'Bienvenido: elige tu contraseña' : 'Elige una contraseña nueva', aviso, form,
      h('p', {class: 'note'}, 'Si usas la app instalada en la pantalla de inicio, ábrela después e inicia sesión con esta contraseña.'));
  };
}

function pantallaCargando(texto) {
  return () => tarjeta(texto || 'Cargando…', null, h('div', {class: 'cargando', 'aria-hidden': 'true'}));
}

/* ───────────────────────── Bloqueo con código ───────────────────────── */

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPin(pin, salt) {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256'}, clave, 256));
}
function pinGuardado() {
  try {
    const p = JSON.parse(ls.get(PIN_KEY));
    return p && usuario && p.uid === usuario.id ? p : null;
  } catch (e) { return null; }
}
async function guardarPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  ls.set(PIN_KEY, JSON.stringify({uid: usuario.id, salt: b64(salt), hash: await hashPin(pin, salt)}));
  ls.del(PIN_FALLOS);
}
async function pinCorrecto(pin) {
  const p = pinGuardado();
  return !!p && (await hashPin(pin, deB64(p.salt))) === p.hash;
}

const campoPin = (name, label) => h('label', {class: 'f'}, label,
  h('input', {type: 'password', name, inputmode: 'numeric', pattern: '[0-9]{4,6}', minlength: '4', maxlength: '6', required: true, autocomplete: 'off', class: 'pin', title: 'De 4 a 6 cifras'}));

let desbloqueado = false;
function pantallaBloqueo(alAbrir, aviso) {
  return () => {
    const form = h('form', {class: 'form'}, campoPin('pin', 'Código'),
      h('div', {class: 'btns'}, h('button', {class: 'btn pri ancho', type: 'submit'}, 'Desbloquear')));
    alEnviar(form, async (e) => {
      if (await pinCorrecto(e.pin.value)) {
        ls.del(PIN_FALLOS);
        desbloqueado = true;
        return alAbrir();
      }
      const fallos = (Number(ls.get(PIN_FALLOS)) || 0) + 1;
      ls.set(PIN_FALLOS, String(fallos));
      if (fallos >= MAX_FALLOS_PIN) {
        await cerrarSesion({sinPreguntar: true});
        return mostrar(pantallaLogin({texto: 'Demasiados intentos con el código. Por seguridad se ha cerrado la sesión: entra con tu contraseña.', tipo: 'bad'}));
      }
      mostrar(pantallaBloqueo(alAbrir, {texto: 'Código incorrecto. Te quedan ' + (MAX_FALLOS_PIN - fallos) + ' intentos.', tipo: 'bad'}));
    });
    setTimeout(() => { const i = document.querySelector('input.pin'); if (i) i.focus(); }, 50);
    return tarjeta('App bloqueada', aviso || {texto: usuario ? usuario.email : ''}, form,
      h('div', {class: 'acceso-enlaces'}, enlace('He olvidado el código', async () => {
        if (!confirm('Se cerrará la sesión y tendrás que entrar con tu contraseña. ¿Seguir?')) return;
        await cerrarSesion({sinPreguntar: true});
        mostrar(pantallaLogin());
      })));
  };
}

function pantallaCrearPin(aviso) {
  return () => {
    const form = h('form', {class: 'form'},
      campoPin('pin', 'Nuevo código (4 a 6 cifras)'),
      campoPin('pin2', 'Repite el código'),
      h('div', {class: 'btns'},
        h('button', {class: 'btn', type: 'button', onclick: () => { salirDePantalla(); location.hash = '#cuenta'; }}, 'Cancelar'),
        h('button', {class: 'btn pri', type: 'submit'}, 'Guardar código')));
    alEnviar(form, async (e) => {
      if (e.pin.value !== e.pin2.value) return mostrar(pantallaCrearPin({texto: 'Los códigos no coinciden.', tipo: 'bad'}));
      await guardarPin(e.pin.value);
      desbloqueado = true;
      salirDePantalla();
      location.hash = '#cuenta';
      toast('Código activado');
    });
    return tarjeta('Bloqueo con código', aviso || {texto: 'Se pedirá al abrir la app y al volver a ella tras 1 minuto. Es propio de este dispositivo.'}, form);
  };
}

/* ───────────────────────── Datos en la nube ───────────────────────── */

function textoAlmacen() {
  return CONFIGURADO && usuario
    ? 'Tus datos se guardan en tu cuenta y se sincronizan entre tus dispositivos. Aun así, exporta una copia de vez en cuando.'
    : 'Tus datos solo están en este dispositivo y navegador. Exporta una copia de vez en cuando y guárdala (por ejemplo en iCloud o Google Drive).';
}

function pintarEstado() {
  const el = document.getElementById('estado-nube');
  if (!el) return;
  const textos = {
    local: ['Solo en este dispositivo', ''],
    ok: ['Guardado', 'ok'],
    guardando: ['Guardando…', ''],
    offline: ['Sin conexión: se guardará al volver', 'warn'],
    error: ['No se pudo guardar', 'bad']
  };
  const [t, c] = textos[nube.estado] || textos.ok;
  el.textContent = window.pantallaCuenta ? '' : t;
  el.className = 'estado ' + c;
}

const claveCache = () => CACHE_PREFIJO + usuario.id;
function guardarCache() {
  ls.set(claveCache(), JSON.stringify({state, actualizado: nube.actualizado, pendiente: nube.pendiente}));
}
function leerCache() {
  try { return JSON.parse(ls.get(claveCache())); } catch (e) { return null; }
}

let temporizadorSubida = null;
function persistirNube() {
  nube.version++;
  nube.pendiente = true;
  nube.estado = 'guardando';
  guardarCache();
  pintarEstado();
  clearTimeout(temporizadorSubida);
  temporizadorSubida = setTimeout(subir, 700);
}

async function subir() {
  if (!usuario || nube.subiendo) return;
  nube.subiendo = true;
  const version = nube.version;
  try {
    const {data, error} = await sb.from('datos').upsert({user_id: usuario.id, contenido: state}).select('actualizado').single();
    if (error) throw error;
    nube.actualizado = data.actualizado;
    if (nube.version === version) { nube.pendiente = false; nube.estado = 'ok'; }
    guardarCache();
  } catch (e) {
    nube.estado = navigator.onLine === false || /fetch|network|Load failed/i.test(String(e && e.message)) ? 'offline' : 'error';
    if (nube.estado === 'error') console.error('Error al guardar en Supabase', e);
  } finally {
    nube.subiendo = false;
    pintarEstado();
    if (nube.pendiente && nube.version !== version) subir();
  }
}

/* Compara con la nube: trae cambios hechos en otro dispositivo o sube los pendientes. */
async function sincronizar() {
  if (!usuario) return;
  const {data, error} = await sb.from('datos').select('contenido, actualizado').eq('user_id', usuario.id).maybeSingle();
  if (error) { nube.estado = 'offline'; pintarEstado(); return false; }
  if (!data) return null; // todavía no hay fila en la nube
  const remotoMasNuevo = !nube.actualizado || new Date(data.actualizado) > new Date(nube.actualizado);
  if (remotoMasNuevo && nube.pendiente) {
    const usarNube = confirm('Tus datos han cambiado en otro dispositivo y aquí también hay cambios sin subir.\n\nAceptar: quedarte con los de la nube.\nCancelar: quedarte con los de este dispositivo.');
    if (!usarNube) { await subir(); return true; }
  }
  if (remotoMasNuevo) {
    state = normalize(data.contenido);
    nube.actualizado = data.actualizado;
    nube.pendiente = false;
    nube.estado = 'ok';
    guardarCache();
    if (!window.pantallaCuenta) render();
  } else if (nube.pendiente) {
    await subir();
  } else {
    nube.estado = 'ok';
  }
  pintarEstado();
  return true;
}

/* Primera vez en la nube: ofrecer subir los datos que ya había en este dispositivo. */
function pantallaMigrar(local) {
  return () => tarjeta('Tus datos de este dispositivo', {texto: 'En este dispositivo hay datos de antes de crear tu cuenta (' + totalFilas(local) + ' filas).'},
    h('p', {class: 'note'}, '¿Quieres guardarlos en tu cuenta? Así los tendrás también en tus otros dispositivos.'),
    h('div', {class: 'btns'},
      h('button', {class: 'btn pri', type: 'button', onclick: async () => {
        state = local; persistirNube(); await subir();
        salirDePantalla(); toast('Datos guardados en tu cuenta'); tareasTrasCargar();
      }}, 'Sí, guardarlos en mi cuenta'),
      h('button', {class: 'btn', type: 'button', onclick: async () => {
        state = emptyState(); persistirNube(); await subir();
        salirDePantalla(); tareasTrasCargar();
      }}, 'No, empezar de cero')));
}

/* ───────────────────────── Sesión ───────────────────────── */

async function entrar(user, {recienEntrado} = {}) {
  usuario = {id: user.id, email: user.email};
  persistir = persistirNube;
  // Al iniciar sesión con contraseña no hace falta pedir también el código.
  if (pinGuardado() && !recienEntrado && !desbloqueado) return mostrar(pantallaBloqueo(() => cargarDatos()));
  desbloqueado = true;
  await cargarDatos();
}

async function cargarDatos() {
  const cache = leerCache();
  if (cache && cache.state) {
    state = normalize(cache.state);
    nube.actualizado = cache.actualizado || null;
    nube.pendiente = !!cache.pendiente;
    nube.estado = nube.pendiente ? 'guardando' : 'ok';
    salirDePantalla();   // se ve al instante con la copia local; luego se sincroniza
  } else {
    mostrar(pantallaCargando('Cargando tus datos…'));
  }
  const r = await sincronizar();
  if (r === false && !cache) {
    return mostrar(() => tarjeta('Sin conexión', {texto: 'No se han podido cargar tus datos. Comprueba internet.', tipo: 'bad'},
      h('div', {class: 'btns'}, h('button', {class: 'btn pri', type: 'button', onclick: () => cargarDatos()}, 'Reintentar'))));
  }
  if (r === null) {
    // Cuenta nueva sin datos en la nube.
    const local = loadLocal();
    if (!cache && totalFilas(local) > 0) return mostrar(pantallaMigrar(local));
    if (!cache) state = emptyState();
    persistirNube();
    await subir();
  }
  if (window.pantallaCuenta) salirDePantalla(); else render();
  pintarEstado();
  tareasTrasCargar();
}

function tareasTrasCargar() {
  if (state.config.preciosAuto) actualizarPrecios(false);
}

async function cerrarSesion({sinPreguntar} = {}) {
  if (!sinPreguntar && !confirm('¿Cerrar sesión en este dispositivo?')) return false;
  if (nube.pendiente) { try { await subir(); } catch (e) { /* se intentó */ } }
  if (usuario) ls.del(claveCache());
  ls.del(PIN_KEY); ls.del(PIN_FALLOS);
  usuario = null; desbloqueado = false;   // antes de signOut, para que no se tome como sesión caducada
  try { await sb.auth.signOut({scope: 'local'}); } catch (e) { /* sin conexión: la sesión local se borra igual */ }
  state = emptyState();
  persistir = () => {};
  nube.actualizado = null; nube.pendiente = false; nube.estado = 'ok';
  return true;
}

/* ───────────────────────── Vista: Cuenta y seguridad ───────────────────────── */

function vistaCuenta() {
  const volverMas = h('a', {class: 'back', href: '#ajustes'}, '← Ajustes');
  if (!CONFIGURADO) {
    return [volverMas, h('section', {class: 'card'},
      h('h2', null, 'Cuenta'),
      h('p', {class: 'note'}, 'La app está funcionando sin cuenta: los datos se guardan solo en este dispositivo.'),
      h('p', {class: 'note'}, 'Para tener inicio de sesión y tus datos sincronizados, rellena config.js con los datos de tu proyecto de Supabase (mira el README).'))];
  }
  const pin = pinGuardado();
  const cambiarPass = () => {
    const dlg = document.getElementById('dialogo');
    const form = document.getElementById('dialogo-form');
    form.replaceChildren(h('h3', null, 'Cambiar contraseña'),
      h('div', {class: 'form'}, campoPass('pass', 'Nueva contraseña (mínimo 8 caracteres)', true), campoPass('pass2', 'Repite la contraseña', true)),
      h('div', {class: 'btns', style: 'margin-top:14px;justify-content:flex-end'},
        h('button', {class: 'btn', type: 'button', onclick: () => dlg.close()}, 'Cancelar'),
        h('button', {class: 'btn pri', type: 'submit'}, 'Guardar')));
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      if (form.elements.pass.value !== form.elements.pass2.value) return toast('Las contraseñas no coinciden');
      const {error} = await sb.auth.updateUser({password: form.elements.pass.value});
      if (error) return toast(traducirError(error));
      dlg.close();
      toast('Contraseña cambiada');
    };
    dlg.showModal();
  };
  return [volverMas,
    h('section', {class: 'card'},
      h('h2', null, 'Tu cuenta'),
      h('p', {class: 'note'}, 'Sesión iniciada como ', h('b', null, usuario ? usuario.email : '—'), '.'),
      h('p', {class: 'note'}, textoAlmacen()),
      h('div', {class: 'btns'},
        h('button', {class: 'btn', type: 'button', onclick: cambiarPass}, 'Cambiar contraseña'),
        h('button', {class: 'btn', type: 'button', onclick: async () => { toast('Sincronizando…'); const r = await sincronizar(); toast(r === false ? 'Sin conexión' : 'Sincronizado'); }}, 'Sincronizar ahora'),
        h('button', {class: 'btn dan', type: 'button', onclick: async () => { if (await cerrarSesion()) mostrar(pantallaLogin({texto: 'Has cerrado la sesión.', tipo: 'ok'})); }}, 'Cerrar sesión'))),
    h('section', {class: 'card'},
      h('h2', null, 'Bloqueo con código'),
      h('p', {class: 'note'}, pin
        ? 'Activado en este dispositivo. Se pide al abrir la app y al volver a ella tras 1 minuto.'
        : 'Pide un código de 4 a 6 cifras al abrir la app, aunque la sesión siga iniciada.'),
      h('div', {class: 'btns'},
        h('button', {class: 'btn' + (pin ? '' : ' pri'), type: 'button', onclick: () => mostrar(pantallaCrearPin())}, pin ? 'Cambiar código' : 'Activar código'),
        pin ? h('button', {class: 'btn dan', type: 'button', onclick: () => {
          if (!confirm('¿Quitar el bloqueo con código en este dispositivo?')) return;
          ls.del(PIN_KEY); render(); toast('Código quitado');
        }}, 'Quitar código') : null))];
}

/* ───────────────────────── Arranque ───────────────────────── */

function limpiarHashDeEnlace() {
  if (/access_token|error_description|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#panel');
}

let ocultoDesde = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    ocultoDesde = Date.now();
    if (usuario && nube.pendiente) subir();
    return;
  }
  if (!usuario) { if (!CONFIGURADO && state.config.preciosAuto) actualizarPrecios(false); return; }
  if (pinGuardado() && ocultoDesde && Date.now() - ocultoDesde > BLOQUEO_TRAS_MS && !window.pantallaCuenta) {
    desbloqueado = false;
    return mostrar(pantallaBloqueo(() => { salirDePantalla(); sincronizar(); tareasTrasCargar(); }));
  }
  if (!window.pantallaCuenta) { sincronizar(); tareasTrasCargar(); }
});
window.addEventListener('online', () => { if (usuario) sincronizar(); });

async function arrancar() {
  if (!CONFIGURADO) {
    // Sin Supabase: como antes, todo en este dispositivo.
    state = loadLocal();
    persistir = saveLocal;
    nube.estado = 'local';
    window.addEventListener('storage', (e) => { if (e.key === KEY) { state = loadLocal(); render(); } });
    render(); pintarEstado();
    tareasTrasCargar();
    return;
  }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: {storage: almacenSesion, storageKey: 'patrimonio-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
  });
  sb.auth.onAuthStateChange((evento) => {
    // No llamar a Supabase dentro del callback (puede bloquearse): se hace en el siguiente ciclo.
    if (evento === 'PASSWORD_RECOVERY') setTimeout(() => mostrar(pantallaNuevaPass('recovery')), 0);
    if (evento === 'SIGNED_OUT' && usuario) setTimeout(async () => { await cerrarSesion({sinPreguntar: true}); mostrar(pantallaLogin({texto: 'La sesión ha caducado. Vuelve a entrar.', tipo: 'bad'})); }, 0);
  });
  mostrar(pantallaCargando());
  if (errorEnlace) {
    limpiarHashDeEnlace();
    return mostrar(pantallaLogin({texto: 'El enlace no es válido o ha caducado. Pide uno nuevo.', tipo: 'bad'}));
  }
  const {data: {session}} = await sb.auth.getSession();
  if (session && (tipoEnlace === 'recovery' || tipoEnlace === 'invite')) {
    limpiarHashDeEnlace();
    usuario = {id: session.user.id, email: session.user.email};
    return mostrar(pantallaNuevaPass(tipoEnlace));
  }
  limpiarHashDeEnlace();
  if (session) await entrar(session.user);
  else mostrar(pantallaLogin(tipoEnlace === 'signup' ? {texto: 'Email confirmado. Ya puedes iniciar sesión.', tipo: 'ok'} : null));
}

/* Repintar el indicador de guardado tras cada render. */
const renderOriginal = render;
render = function () { renderOriginal(); pintarEstado(); };

arrancar();

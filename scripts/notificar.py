"""Envía las notificaciones de PatriApp a los dispositivos que las tienen activadas.

Modos:
  python scripts/notificar.py cartera --prev precios_anteriores.json   (tras buscar los precios del lunes)
  python scripts/notificar.py diario                                   (varias veces al día)
  python scripts/notificar.py prueba                                   (una notificación de prueba a todos)

Necesita estos secretos de GitHub (Settings → Secrets and variables → Actions):
  SUPABASE_SERVICE_KEY  clave secreta de Supabase (service_role o sb_secret_…), para leer las suscripciones
  VAPID_PRIVATE_KEY     clave privada de las notificaciones (la pública está en config.js)
"""
import argparse
import calendar
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent.parent
ZONA = ZoneInfo("Europe/Madrid")
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
URL_APP = "https://alejandro-sanchez03.github.io/PatriApp/"


# ───────────── Formato ─────────────

def eur(v, dec=0):
    s = f"{abs(v):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if abs(v) < 10000:
        s = s.replace(".", "")          # en español, 4 cifras sin punto de miles (1279 €)
    return ("−" if v < 0 else "") + s + " €"


def con_signo(v, dec=2):
    return ("+" if v >= 0 else "−") + eur(abs(v), dec)


def pct(v, dec=1):
    if dec == 1 and 0 < abs(v) < 0.001:
        dec = 2                       # cambios muy pequeños: +0,02 % en vez de +0,0 %
    return ("+" if v >= 0 else "−") + f"{abs(v) * 100:.{dec}f}".replace(".", ",") + " %"


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


# ───────────── Supabase ─────────────

def leer_config():
    cfg = (RAIZ / "config.js").read_text(encoding="utf-8")
    url = re.search(r"supabaseUrl:\s*'([^']+)'", cfg).group(1).rstrip("/")
    return url


class Supabase:
    def __init__(self, url, clave):
        self.url = url
        self.cab = {"apikey": clave, "Content-Type": "application/json"}
        if not clave.startswith("sb_secret_"):
            self.cab["Authorization"] = "Bearer " + clave

    def pedir(self, metodo, ruta, cuerpo=None):
        req = urllib.request.Request(self.url + "/rest/v1/" + ruta, method=metodo, headers=self.cab,
                                     data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
        with urllib.request.urlopen(req, timeout=30) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto else None

    def suscripciones(self):
        return self.pedir("GET", "push_subs?select=id,user_id,endpoint,p256dh,auth,prefs,enviados") or []

    def datos(self, ids):
        if not ids:
            return {}
        filtro = urllib.parse.quote("(" + ",".join(ids) + ")")
        filas = self.pedir("GET", f"datos?select=user_id,contenido&user_id=in.{filtro}") or []
        return {f["user_id"]: f.get("contenido") or {} for f in filas}

    def guardar_enviados(self, sub_id, enviados):
        self.pedir("PATCH", f"push_subs?id=eq.{sub_id}", {"enviados": enviados})

    def borrar(self, sub_id):
        self.pedir("DELETE", f"push_subs?id=eq.{sub_id}")


# ───────────── Envío ─────────────

def enviar(sub, aviso, clave_privada):
    """Devuelve True si se envió, False si la suscripción ya no existe (hay que borrarla)."""
    from pywebpush import WebPushException, webpush
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=json.dumps(aviso, ensure_ascii=False),
            vapid_private_key=clave_privada,
            vapid_claims={"sub": "https://alejandro-sanchez03.github.io"},
            ttl=24 * 3600,
        )
        return True
    except WebPushException as e:
        codigo = getattr(e.response, "status_code", None)
        if codigo in (404, 410):
            return False
        print(f"  ✗ error al enviar ({codigo}): {e}")
        return True


# ───────────── Cálculos (los mismos que hace la app) ─────────────

def mes_de(fecha):
    return str(fecha or "")[:7]


def gastos_por_categoria(datos, mes):
    previsto, gastado = {}, {}
    for p in datos.get("presupuesto", []):
        if p.get("mes") == mes and p.get("concepto"):
            previsto[p["concepto"]] = previsto.get(p["concepto"], 0) + num(p.get("cantidad")) * num(p.get("precio"))
    for g in datos.get("gastos", []):
        if mes_de(g.get("fecha")) == mes:
            gastado[g.get("categoria")] = gastado.get(g.get("categoria"), 0) + num(g.get("importe"))
    return previsto, gastado


def resumen_mes(datos, mes):
    ingresos = sum(num(i.get("importe")) for i in datos.get("ingresos", []) if i.get("mes") == mes)
    gastos = sum(num(g.get("importe")) for g in datos.get("gastos", []) if mes_de(g.get("fecha")) == mes)
    return ingresos, gastos


def avisos_cartera(datos, prev, nuevo):
    antes = despues = 0.0
    mejor = None
    for f in datos.get("cartera", []):
        isin = str(f.get("isin", "")).strip().upper()
        part = num(f.get("participaciones"))
        a, b = prev.get(isin), nuevo.get(isin)
        if not (a and b and part > 0 and num(a.get("vl_eur")) > 0):
            continue
        va, vb = part * num(a["vl_eur"]), part * num(b["vl_eur"])
        antes += va
        despues += vb
        cambio = vb / va - 1
        if mejor is None or cambio > mejor[1]:
            mejor = (f.get("fondo", isin), cambio)
    if antes <= 0:
        return None
    dif = despues - antes
    nombre = re.sub(r"\s+(Index Fund|Fund|P-ACC|EUR|USD|Hedged|Acc|Cap|I|D).*$", "", mejor[0]) if mejor else ""
    return {
        "titulo": ("📈" if dif >= 0 else "📉") + " Tu cartera esta semana",
        "cuerpo": f"{con_signo(dif)} ({pct(dif / antes)}) · ahora {eur(despues)}." + (f" Mejor: {nombre} ({pct(mejor[1])})." if mejor else ""),
        "url": "./#inversion", "etiqueta": "cartera",
    }


def avisos_diarios(datos, prefs, enviados, ahora):
    hoy = ahora.date()
    mes = hoy.strftime("%Y-%m")
    out = []  # (clave, aviso)
    # Día 1: resumen del mes anterior y recordatorio
    if prefs.get("mensual", True) and hoy.day == 1:
        anterior = (hoy.replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
        ing, gas = resumen_mes(datos, anterior)
        nombre = MESES[int(anterior[5:]) - 1]
        if ing > 0:
            ahorro = ing - gas
            texto = f"Has ahorrado {eur(ahorro)} ({pct(ahorro / ing, 0).lstrip('+')})." if ahorro >= 0 else f"Has gastado {eur(-ahorro)} más de lo que ingresaste."
        else:
            texto = f"Gastaste {eur(gas)}."
        out.append((f"mensual:{mes}", {"titulo": f"📅 Resumen de {nombre}", "cuerpo": texto + " Hoy toca actualizar tus saldos y ajustar la cartera.", "url": "./#resumen", "etiqueta": "mensual"}))
    # Día de cobro
    dia = int(num(prefs.get("diaCobro")))
    if dia > 0 and hoy.day == min(dia, calendar.monthrange(hoy.year, hoy.month)[1]):
        ya = any(i.get("mes") == mes for i in datos.get("ingresos", []))
        if not ya:
            out.append((f"cobro:{mes}", {"titulo": "💰 ¿Has cobrado?", "cuerpo": "Apunta la nómina y te digo cuánto mover a ahorro e inversión.", "url": "./#nominas", "etiqueta": "cobro"}))
    # Presupuesto
    if prefs.get("presupuesto", True):
        previsto, gastado = gastos_por_categoria(datos, mes)
        for cat, prev in previsto.items():
            g = gastado.get(cat, 0)
            if prev <= 0 or g < prev * 0.9:
                continue
            nivel = 100 if g > prev else 90
            if f"pres:{mes}:{cat}:100" in enviados or (nivel == 90 and f"pres:{mes}:{cat}:90" in enviados):
                continue
            cuerpo = (f"Te has pasado: llevas {eur(g)} de {eur(prev)} este mes." if nivel == 100
                      else f"Llevas {eur(g)} de {eur(prev)} ({round(g / prev * 100)} %) este mes.")
            out.append((f"pres:{mes}:{cat}:{nivel}", {"titulo": f"⚠️ {cat}", "cuerpo": cuerpo, "url": "./#gastos", "etiqueta": f"pres-{cat}"}))
    return [(k, a) for k, a in out if k not in enviados]


# ───────────── Programa ─────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("modo", choices=["cartera", "diario", "prueba"])
    ap.add_argument("--prev", help="precios.json de la semana anterior (modo cartera)")
    args = ap.parse_args()

    clave_sb, clave_vapid = os.environ.get("SUPABASE_SERVICE_KEY", ""), os.environ.get("VAPID_PRIVATE_KEY", "")
    if not clave_sb or not clave_vapid:
        print("Faltan los secretos SUPABASE_SERVICE_KEY o VAPID_PRIVATE_KEY: no se envía nada.")
        return
    sb = Supabase(os.environ.get("SUPABASE_URL") or leer_config(), clave_sb)
    subs = sb.suscripciones()
    print(f"{len(subs)} dispositivos con notificaciones")
    if not subs:
        return
    datos = sb.datos(sorted({s["user_id"] for s in subs}))
    ahora = dt.datetime.now(ZONA)
    if os.environ.get("PATRIAPP_AHORA"):          # solo para pruebas
        ahora = dt.datetime.fromisoformat(os.environ["PATRIAPP_AHORA"]).replace(tzinfo=ZONA)

    precios_prev = precios_nuevo = None
    if args.modo == "cartera":
        try:
            precios_prev = json.loads(Path(args.prev).read_text(encoding="utf-8")).get("fondos", {})
            precios_nuevo = json.loads((RAIZ / "precios.json").read_text(encoding="utf-8")).get("fondos", {})
        except Exception as e:  # noqa: BLE001 — sin semana anterior no hay comparación
            print(f"Sin precios anteriores para comparar: {e}")
            return

    enviados_total = 0
    for s in subs:
        prefs = s.get("prefs") or {}
        enviados = dict(s.get("enviados") or {})
        d = datos.get(s["user_id"], {})
        if args.modo == "prueba":
            pendientes = [(None, {"titulo": "🔔 PatriApp", "cuerpo": "Las notificaciones funcionan. ¡Listo!", "url": "./#panel", "etiqueta": "prueba"})]
        elif args.modo == "cartera":
            aviso = avisos_cartera(d, precios_prev, precios_nuevo) if prefs.get("cartera", True) else None
            clave = "cartera:" + ahora.strftime("%Y-%m-%d")
            pendientes = [(clave, aviso)] if aviso and clave not in enviados else []
        else:
            pendientes = avisos_diarios(d, prefs, enviados, ahora)
        vivo = True
        for clave, aviso in pendientes:
            vivo = enviar(s, aviso, clave_vapid)
            if not vivo:
                print(f"  dispositivo {s['id']} dado de baja: se borra")
                sb.borrar(s["id"])
                break
            print(f"  → {s['id']}: {aviso['titulo']} — {aviso['cuerpo']}")
            enviados_total += 1
            if clave:
                enviados[clave] = ahora.isoformat(timespec="minutes")
        if vivo and pendientes and args.modo != "prueba":
            # Se guardan solo las 80 claves más recientes
            recientes = dict(sorted(enviados.items(), key=lambda x: x[1])[-80:])
            sb.guardar_enviados(s["id"], recientes)
    print(f"{enviados_total} notificaciones enviadas")


if __name__ == "__main__":
    sys.exit(main())

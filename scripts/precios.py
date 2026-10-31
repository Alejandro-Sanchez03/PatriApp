"""Busca el valor liquidativo más reciente de cada fondo de fondos.json y escribe precios.json.

Lo ejecuta cada lunes la acción de GitHub (.github/workflows/precios.yml).
Solo usa precios públicos: no guarda participaciones ni importes.

Fuentes, en orden: Financial Times (markets.ft.com) y Morningstar.
Los fondos en USD se pasan a EUR con el cambio del BCE (vía frankfurter.app).
Si un fondo falla, se conserva su último precio conocido.
"""
import datetime as dt
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONDOS = RAIZ / "fondos.json"
SALIDA = RAIZ / "precios.json"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-GB,en;q=0.9"}
MESES_EN = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def num(txt):
    return float(txt.replace(",", ""))


def precio_ft(isin, moneda):
    """Página de resumen del fondo en el Financial Times."""
    url = f"https://markets.ft.com/data/funds/tearsheet/summary?s={isin}:{moneda}"
    pag = get(url)
    m = re.search(r'mod-ui-data-list__value">\s*([\d,]+\.?\d*)\s*<', pag)
    if not m:
        raise ValueError("no aparece el precio en la página del FT")
    vl = num(m.group(1))
    fecha = None
    f = re.search(r"as of ([A-Z][a-z]{2}) (\d{1,2}) (\d{4})", html.unescape(pag))
    if f and f.group(1) in MESES_EN:
        fecha = dt.date(int(f.group(3)), MESES_EN[f.group(1)], int(f.group(2))).isoformat()
    m2 = re.search(r"Price \(([A-Z]{3})\)", pag)
    return {"vl": vl, "moneda": m2.group(1) if m2 else moneda, "fecha": fecha, "fuente": "Financial Times"}


def precio_morningstar(isin, moneda):
    """Buscador público de Morningstar."""
    q = urllib.parse.urlencode({
        "page": 1, "pageSize": 5, "sortOrder": "LegalName asc", "outputType": "json", "version": 1,
        "languageId": "es-ES", "currencyId": moneda, "universeIds": "FOESP$$ALL",
        "securityDataPoints": "SecId|Name|ClosePrice|ClosePriceDate|PriceCurrency|isin", "term": isin,
    })
    datos = json.loads(get("https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener?" + q))
    filas = [r for r in datos.get("rows", []) if r.get("ClosePrice")]
    if not filas:
        raise ValueError("Morningstar no devuelve precio")
    r = filas[0]
    return {"vl": float(r["ClosePrice"]), "moneda": r.get("PriceCurrency") or moneda,
            "fecha": (r.get("ClosePriceDate") or "")[:10] or None, "fuente": "Morningstar"}


def usd_a_eur():
    """Euros por 1 dólar, con el cambio de referencia del BCE."""
    datos = json.loads(get("https://api.frankfurter.app/latest?from=USD&to=EUR"))
    return float(datos["rates"]["EUR"]), datos.get("date")


def main():
    fondos = json.loads(FONDOS.read_text(encoding="utf-8"))
    previo = json.loads(SALIDA.read_text(encoding="utf-8")) if SALIDA.exists() else {}
    salida = {"actualizado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
              "fondos": dict(previo.get("fondos", {})), "errores": []}
    cambio = None
    ok = 0
    for f in fondos:
        isin = f["isin"].strip().upper()
        moneda = f.get("moneda", "EUR").upper()
        precio, errores = None, []
        for fuente in (precio_ft, precio_morningstar):
            try:
                precio = fuente(isin, moneda)
                break
            except Exception as e:  # noqa: BLE001 — se prueba la siguiente fuente
                errores.append(f"{fuente.__name__}: {e}")
        if not precio:
            salida["errores"].append({"isin": isin, "detalle": errores})
            print(f"✗ {isin}: {errores}")
            continue
        if precio["moneda"] == "EUR":
            precio["vl_eur"] = precio["vl"]
        elif precio["moneda"] == "USD":
            if cambio is None:
                cambio = usd_a_eur()
            precio["vl_eur"] = round(precio["vl"] * cambio[0], 6)
            precio["cambio_usd_eur"] = cambio[0]
        else:
            salida["errores"].append({"isin": isin, "detalle": [f"moneda no soportada: {precio['moneda']}"]})
            continue
        precio["fecha"] = precio["fecha"] or dt.date.today().isoformat()
        salida["fondos"][isin] = precio
        ok += 1
        print(f"✓ {isin}: {precio['vl']} {precio['moneda']} ({precio['fecha']}, {precio['fuente']})")

    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{ok} de {len(fondos)} fondos actualizados")
    if ok == 0:
        sys.exit("No se pudo actualizar ningún fondo")


if __name__ == "__main__":
    main()

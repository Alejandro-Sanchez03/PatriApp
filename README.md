# Mi Patrimonio

App web instalable (PWA) para seguir el patrimonio: saldos por cuenta, gastos, nóminas y su reparto, presupuesto mensual, cartera indexada y evolución del patrimonio. Es la versión independiente del panel «Finanzas» que tenía en Claude.

## Privacidad

**Los datos no están en este repositorio.** La app los guarda solo en el navegador del dispositivo donde la usas (`localStorage`); nada se envía a ningún servidor. El repositorio es público, así que **no subas aquí tu copia de seguridad** (`.gitignore` ya ignora `patrimonio-*.json`).

## Publicarla con GitHub Pages

1. En GitHub: **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**, la rama (por ejemplo `main`) y la carpeta `/ (root)`. Guarda.
3. En un par de minutos estará en: `https://<tu-usuario>.github.io/patrimonio/`

## Instalarla en el móvil

- **iPhone (Safari):** abre la dirección → botón Compartir → «Añadir a pantalla de inicio».
- **Android (Chrome):** abre la dirección → menú ⋮ → «Instalar aplicación».

Funciona sin conexión después de abrirla una vez.

## Primeros pasos

1. Abre **Más → Copia de seguridad → Importar…** y elige tu archivo `patrimonio-*.json`.
2. A partir de ahí:
   - **Gastos:** apunta cada gasto (devoluciones y Bizum recibidos en negativo).
   - **Saldos:** escribe lo que hay en cada cuenta y pulsa «Guardar saldos»: se añade un punto a la evolución.
   - **Cartera:** actualiza valor e invertido de cada fondo.
   - **Más → Nóminas:** apunta la nómina y las transferencias; el panel te dice cuánto mover.
   - **Más → Reglas de reparto:** margen, % a la cuenta remunerada, meses de colchón, cuota del coche.
3. Exporta una copia de seguridad de vez en cuando (Más → Copia de seguridad → Exportar).

## Cómo calcula

- **Patrimonio neto:** suma de todos los saldos.
- **Dinero disponible:** cuentas de grupo *Liquidez* y *Efectivo*.
- **Colchón:** *Fondo de emergencia* + *Cuenta remunerada*, en meses de los gastos previstos.
- **Reparto de la nómina:** en la cuenta corriente quedan los gastos previstos del mes siguiente + el margen; lo que sobra va un % a la cuenta remunerada y el resto a la cartera, en decenas. Si marcas la nómina como «Reparto cerrado», muestra lo que moviste de verdad.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Estilos (modo claro y oscuro) |
| `app.js` | Lógica, cálculos y almacenamiento |
| `manifest.webmanifest`, `icon*` | Instalación como app |
| `sw.js` | Funcionamiento sin conexión. Si cambias algún archivo, sube `CACHE = 'patrimonio-v1'` a `v2`, etc. |

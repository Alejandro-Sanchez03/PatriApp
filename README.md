# PatriApp

App web instalable (PWA) para seguir el patrimonio: saldos por cuenta, gastos, nóminas y su reparto, presupuesto mensual, cartera indexada y evolución del patrimonio. Es la versión independiente del panel «Finanzas» que tenía en Claude.

## Cuentas y privacidad

- Cada persona entra con **email y contraseña** y solo ve **sus propios datos** (reglas de seguridad de la base de datos).
- Los datos se guardan en **Supabase** y se sincronizan entre dispositivos. También queda una copia en el dispositivo para que funcione sin conexión.
- **Recordar sesión**, **recuperar contraseña** por email y **bloqueo con código** (PIN de 4–6 cifras, en Más → Cuenta y seguridad).
- El repositorio es público, pero **no contiene ningún dato personal**: la clave de `config.js` es la pública de Supabase y la protección la ponen las reglas de `supabase/esquema.sql`. No subas aquí tus copias de seguridad (`.gitignore` ignora `patrimonio-*.json`).
- Si `config.js` está vacío, la app funciona sin cuenta, guardando solo en el dispositivo.

## Configurar Supabase (una vez)

1. Entra en [supabase.com](https://supabase.com) → **Start your project** → entra con GitHub.
2. **New project**: nombre `Patrimonio`, una contraseña de base de datos (guárdala), región **Europe (Frankfurt o Ireland)**, plan **Free**. Espera 1–2 minutos.
3. **SQL Editor → New query**: pega todo `supabase/esquema.sql` y pulsa **Run**. Debe decir *Success*.
4. **Authentication → URL Configuration**:
   - *Site URL*: `https://alejandro-sanchez03.github.io/Patrimonio/`
   - *Redirect URLs* → **Add URL**: la misma dirección.
5. **Project Settings → API** (o el botón **Connect**): copia *Project URL* y la clave *anon public*.
6. En GitHub, abre `config.js` → lápiz ✏️ → pega los dos valores entre las comillas → **Commit changes**.
7. Abre la app, **Crear una cuenta**, confirma el email y entra. La primera vez te ofrecerá subir los datos que ya tenías en ese dispositivo.

**Actualización 8 (una vez):** en **SQL Editor → New query**, pega `supabase/actualizacion-v8.sql` y pulsa **Run**. Activa el historial de versiones en la nube, el botón «Eliminar mi cuenta» y la lista de ISIN (sin importes) para que la búsqueda de precios de los lunes encuentre también los fondos de los demás usuarios.

**Actualización 9 (una vez):** ejecuta igual `supabase/actualizacion-v9.sql`. Activa los **pagos con Apple Pay**: en la app, **Ajustes → Pagos con Apple Pay → Activar** y sigue los pasos para crear la automatización «Transacción» en la app Atajos del iPhone. Cada pago con Apple Pay se apunta solo, con su categoría.

**Actualización 10 (una vez):** ejecuta igual `supabase/actualizacion-v10.sql`. Añade el «último pago recibido» en Pagos con Apple Pay.

**Actualización 11 (una vez): notificaciones.**
1. Ejecuta `supabase/actualizacion-v11.sql` en el SQL Editor.
2. En GitHub → **Settings → Secrets and variables → Actions → New repository secret**, crea dos secretos:
   - `VAPID_PRIVATE_KEY`: la clave privada de las notificaciones (la pública está en `config.js`).
   - `SUPABASE_SERVICE_KEY`: en Supabase → **Project Settings → API Keys**, la clave **secreta** (`sb_secret_…` o `service_role`). Solo va aquí, nunca en el código.
3. En la app: **Ajustes → Notificaciones → Activar** (en cada dispositivo).
4. Para probar: **Actions → Notificaciones → Run workflow → prueba**.

**Para las demás personas:** que creen su cuenta desde la app. Cuando estéis todos, cierra el registro en **Authentication → Sign In / Providers → Allow new users to sign up** (desactivado) y pon `registroAbierto: false` en `config.js`. Para añadir a alguien después: **Authentication → Users → Invite user** (recibirá un email para elegir contraseña).

**A tener en cuenta del plan gratis:** Supabase pausa los proyectos sin uso durante 7 días seguidos; si pasa, entra en supabase.com y pulsa **Restore**. Los emails (confirmación, recuperar contraseña) tienen un límite de unos pocos por hora.

## Publicarla con GitHub Pages

1. En GitHub: **Settings → Pages**.
2. En *Source* elige **Deploy from a branch**, la rama (por ejemplo `main`) y la carpeta `/ (root)`. Guarda.
3. En un par de minutos estará en: `https://<tu-usuario>.github.io/patrimonio/`

## Instalarla en el móvil

- **iPhone (Safari):** abre la dirección → botón Compartir → «Añadir a pantalla de inicio».
- **Android (Chrome):** abre la dirección → menú ⋮ → «Instalar aplicación».

Funciona sin conexión después de abrirla una vez.

## Primeros pasos

1. Inicia sesión. Si es tu primera vez y no tenías datos en ese dispositivo, impórtalos en **Más → Copia de seguridad → Importar…** con tu archivo `patrimonio-*.json`.
2. A partir de ahí:
   - **Gastos:** apunta cada gasto (devoluciones y Bizum recibidos en negativo).
   - **Saldos:** escribe lo que hay en cada cuenta y pulsa «Guardar saldos»: se añade un punto a la evolución.
   - **Cartera:** actualiza valor e invertido de cada fondo.
   - **Más → Nóminas:** apunta la nómina y las transferencias; el panel te dice cuánto mover.
   - **Más → Reglas de reparto:** margen, % a la cuenta remunerada, meses de colchón, cuota del coche.
3. Exporta una copia de seguridad de vez en cuando (Más → Copia de seguridad → Exportar).

## Precios de los fondos (cada lunes)

- La acción de GitHub `.github/workflows/precios.yml` se ejecuta los lunes por la mañana. Busca el valor liquidativo de cada ISIN de `fondos.json` (Financial Times y, si falla, Morningstar), pasa a euros los fondos en dólares con el cambio del BCE y guarda `precios.json`.
- `fondos.json` y `precios.json` solo tienen ISIN, moneda y precios: **ninguna participación ni importe tuyo**.
- Al abrir la app, para cada fondo con ISIN y participaciones: valor = participaciones × precio en €. También se actualiza el saldo de «Cartera indexada» y se añade un punto a la evolución.
- **Si compras un fondo nuevo**, añádelo en la app (con su ISIN y participaciones) **y** en `fondos.json`.
- Para lanzarlo a mano: pestaña **Actions → Actualizar precios de fondos → Run workflow**.
- Si una semana falla, GitHub te avisa por correo y la app mantiene el último precio.

## Funciones

- **Inicio:** patrimonio con gráfico, avisos (presupuesto, saldos sin actualizar, cartera por ajustar, nómina sin repartir), objetivo FIRE y ahorro del mes.
- **Gastos:** por meses, por categoría (toca una para filtrar), buscador en todos los meses, **recurrentes** que se apuntan solos, **resumen del mes** con la tasa de ahorro e **importación** del Excel o CSV del banco.
- **Inversión:** fondos con precios automáticos, aportaciones repartidas entre los fondos, ajuste con MyInvestor e impuestos estimados si vendieras.
- **Ajustes:** tema claro u oscuro, Face ID, código, reglas, **historial de versiones** (nube y dispositivo), copia de seguridad y eliminar cuenta.

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
| `app.js` | Panel, cálculos y pantallas |
| `cuenta.js` | Inicio de sesión, código y sincronización con Supabase |
| `config.js` | Datos de tu proyecto de Supabase |
| `supabase/esquema.sql` | Tabla y reglas de seguridad de la base de datos |
| `vendor/supabase.js` | Librería de Supabase (v2.45.4, licencia MIT) |
| `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png`, `favicon-32.png` | Nombre e iconos de la app |
| `sw.js` | Funcionamiento sin conexión. Si cambias algún archivo, sube el número de `CACHE = 'patrimonio-v4'`. |

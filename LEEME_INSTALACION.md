# ERP POS LITE — Guía de Instalación (Google Sheets + Apps Script)

Este sistema tiene **dos partes** que se instalan por separado:

1. **`Code.gs`** → el backend. Vive dentro de un proyecto de Google Apps Script y usa una
   Google Sheet como base de datos. Se publica como "Web App" y expone una URL (`.../exec`)
   que responde en formato JSON.
2. **`index.html`** → el frontend (la pantalla que ve el cajero/administrador). Es un archivo
   HTML independiente que **no vive dentro de Apps Script**: se abre en cualquier navegador
   y simplemente le hace peticiones a la URL del paso 1.

Sigue los pasos en orden. Toma unos 10 minutos la primera vez.

---

## Paso 1 — Crear la Google Sheet (base de datos)

1. Ve a [sheets.google.com](https://sheets.google.com) y crea una hoja de cálculo nueva
   (puede estar en blanco, las pestañas se crean solas más adelante). Nómbrala, por ejemplo,
   `ERP POS LITE - Base de Datos`.
2. Copia el **ID de la hoja**: es el texto largo que aparece en la URL entre `/d/` y `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID_QUE_NECESITAS/edit
   ```

---

## Paso 2 — Crear el proyecto de Apps Script

1. Con la hoja abierta, ve a **Extensiones → Apps Script**. Se abrirá el editor de código
   en una pestaña nueva, ya conectado a esa hoja.
2. Borra el contenido de `Code.gs` que aparece por defecto (la función `myFunction`) y
   pega **todo** el contenido del archivo `Code.gs` que te compartí.
3. Busca esta línea, cerca del inicio del archivo:

   ```javascript
   const SPREADSHEET_ID = "1g1jENAm0IxzPZ69Gk-KrEZvpfsjOitW31OrgrkKZaoU";
   ```

   y reemplaza el texto entre comillas por el **ID que copiaste en el Paso 1**.
4. Guarda el proyecto (icono de disquete o `Ctrl+S`). Ponle un nombre, por ejemplo
   `ERP POS LITE - Backend`.

---

## Paso 3 — Crear las hojas y dar permisos

1. En la parte superior del editor, en el menú desplegable de funciones (donde dice
   `doGet` por defecto), selecciona la función **`iniciarBD`**.
2. Da clic en **Ejecutar** (▶). La primera vez Google te pedirá autorizar permisos:
   - "Se requiere autorización" → **Revisar permisos**.
   - Elige tu cuenta de Google.
   - Puede aparecer una advertencia de "Google no verificó esta app" → clic en
     **Configuración avanzada** → **Ir a [nombre del proyecto] (no seguro)** → **Permitir**.
   - Este sistema necesita acceso a **Hojas de cálculo** (para guardar los datos) y a
     **Gmail** (para poder enviar los correos de reportes y facturas). Es normal y es tu
     propia cuenta la que envía esos correos.
3. Cuando termine de ejecutarse, ve a tu Google Sheet: deberías ver pestañas nuevas
   (`Categorias`, `Productos`, `Ventas`, `VentaDetalle`, `Responsables`, etc.). Si las ves,
   ¡la base de datos quedó lista!

---

## Paso 4 — Publicar el backend como "Web App"

1. En el editor de Apps Script, botón **Implementar** (arriba a la derecha) →
   **Nueva implementación**.
2. En "Selecciona el tipo", clic en el ícono de engranaje ⚙️ → elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** Yo (tu cuenta) — así los correos salen desde tu Gmail.
   - **Quién tiene acceso:** *Cualquier usuario* (para que el frontend pueda llamarla
     sin pedir login de Google en cada petición).
4. Clic en **Implementar**. Te pedirá autorizar de nuevo — acepta igual que en el Paso 3.
5. Copia la **URL de la aplicación web** que te entrega (termina en `/exec`). Esa es la
   URL de tu backend.

> 📌 Cada vez que hagas cambios a `Code.gs` en el futuro, tienes que volver a
> **Implementar → Administrar implementaciones → ✏️ (editar) → Nueva versión → Implementar**
> para que los cambios se reflejen en la URL. Si solo creas una "implementación" nueva sin
> actualizar la existente, te dará una URL distinta y tendrías que actualizar el frontend otra vez.

---

## Paso 5 — Conectar el frontend (`index.html`) con tu backend

1. Abre el archivo `index.html` con cualquier editor de texto (Bloc de notas, VS Code, etc.).
2. Busca esta línea (cerca de la parte donde empieza el `<script>`):

   ```javascript
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec";
   ```

3. Reemplaza esa URL por la que copiaste en el Paso 4. Guarda el archivo.

---

## Paso 6 — Abrir / publicar el frontend

Tienes tres formas de usarlo, de más simple a más "profesional":

### Opción A — Abrirlo localmente (la más simple)
Solo haz doble clic sobre `index.html` y se abrirá en tu navegador. Funciona perfectamente
para uso personal en una sola computadora. Puedes crear un acceso directo en el escritorio.

### Opción B — Compartirlo en la nube (Google Drive)
Sube `index.html` a una carpeta de Google Drive y ábrelo con "Abrir con → Navegador" o
descárgalo en cada computadora donde lo vayas a usar. (Google Drive no lo "ejecuta" como
página web, solo lo almacena para que lo descargues).

### Opción C — Hospedarlo como página web real (recomendado si varias personas lo usarán)
Sube `index.html` a un hosting estático gratuito, por ejemplo:
- **GitHub Pages** (github.com → crea un repositorio → sube el archivo → activa Pages).
- **Netlify** o **Vercel** (arrastra el archivo a su panel, te dan una URL al instante).
- **Google Sites** (menos directo, pero también sirve).

Con cualquiera de estas opciones obtienes una URL fija (ej. `https://tu-negocio.netlify.app`)
que puedes abrir desde cualquier computadora o celular, sin depender de un solo equipo.

---

## Paso 7 — Ingresar al sistema

- **Usuario:** `admin`
- **Contraseña:** `admin123`

Al entrar a **Ajustes** o **Responsables de Reportes**, el sistema pedirá una contraseña
adicional: **`747`**.

> Si quieres cambiar cualquiera de estas contraseñas, búscalas en `index.html`:
> - Usuario/contraseña de acceso: función `handleLogin()` (`u === 'admin' && p === 'admin123'`).
> - Contraseña de Ajustes/Responsables: constante `AJUSTES_PASSWORD = '747'`.

---

## Paso 8 (opcional) — Activar los reportes automáticos por correo

Los reportes mensuales, anuales y la alerta diaria de stock bajo se envían solos **solo si
programas un disparador** (trigger) en Apps Script:

1. En el editor de Apps Script, ve al ícono del reloj ⏰ (**Activadores/Triggers**) en el
   menú lateral izquierdo.
2. **Añadir activador**:
   - Función a ejecutar: **`enviarReportesProgramados`**
   - Fuente del evento: **Basado en tiempo**
   - Tipo de activador: **Temporizador diario**
   - Hora: la que prefieras (ej. 7:00–8:00 a.m.)
3. Guarda. Desde ese momento, cada día el sistema revisará automáticamente si hay que
   enviar el resumen mensual (día 1), el resumen anual (1 de enero) o la alerta de stock bajo.

El aviso inmediato de "venta grande" **no necesita trigger**: se dispara solo, en el momento
en que se registra una venta que supera el umbral configurado.

---

## Notas importantes

- **Envío de correos:** se hace con tu propia cuenta de Gmail (`MailApp`). Cuentas gratuitas
  de Gmail tienen un límite de ~100 correos/día; cuentas de Google Workspace, ~1500/día.
- **Envío por WhatsApp:** no requiere ninguna configuración adicional, pero funciona distinto
  al correo: el sistema abre un enlace de WhatsApp Web/App con el mensaje ya escrito
  (el listado de la compra). Si el formato elegido es "PDF" o "Ambos", el PDF se descarga
  al dispositivo para que lo adjuntes manualmente en el chat, ya que WhatsApp no permite
  adjuntar archivos automáticamente desde un enlace.
- **Archivos de Hacienda:** se guardan en base64 dentro de la misma hoja de cálculo, por lo
  que hay un límite práctico de ~30 KB por archivo (limitación de Google Sheets, no del código).
- **Modo mantenimiento:** si alguna vez necesitas bloquear el sistema temporalmente (por
  ejemplo, mientras haces cambios), puedes activarlo llamando a la acción
  `?action=activarMantenimiento` desde el navegador, apuntando a tu URL `.../exec`.

---

## Resumen rápido (checklist)

- [ ] Crear Google Sheet y copiar su ID
- [ ] Crear proyecto de Apps Script y pegar `Code.gs`
- [ ] Reemplazar `SPREADSHEET_ID`
- [ ] Ejecutar `iniciarBD` una vez y autorizar permisos
- [ ] Implementar como Aplicación Web (acceso: Cualquier usuario) y copiar la URL `/exec`
- [ ] Pegar esa URL en `SCRIPT_URL` dentro de `index.html`
- [ ] Abrir/hospedar `index.html`
- [ ] Entrar con `admin` / `admin123`
- [ ] (Opcional) Programar el disparador diario de `enviarReportesProgramados`

# 🚀 ERP POS LITE

Sistema de Punto de Venta (POS) y Gestión de Inventario ligero, rápido y optimizado para dispositivos móviles y de escritorio. Construido con HTML, CSS y JavaScript puro (sin frameworks ni build), usando **Google Apps Script (Google Sheets)** como base de datos en la nube.

Este mismo instructivo está integrado dentro del sistema: se puede abrir en cualquier momento desde **Soporte → Instructivo**, sin salir de la aplicación.

---

## 📑 Índice
1. [Características Principales](#-características-principales)
2. [Estructura de Archivos](#-estructura-de-archivos)
3. [Módulos del Sistema](#-módulos-del-sistema)
4. [Guía de Uso Rápido](#-guía-de-uso-rápido)
5. [Escáner de Código de Barras](#-escáner-de-código-de-barras)
6. [Instalación y Despliegue](#-instalación-y-despliegue)
7. [Flujo de Datos (Cómo funciona)](#-flujo-de-datos-cómo-funciona)

---

## ✨ Características Principales

* **Lector de Código de Barras Integrado:** usa la cámara del celular o la PC para escanear productos, tanto en Ventas como en Registro de Producto y Registro Masivo.
* **Escáner optimizado para móvil:** el visor de cámara tiene una altura acotada (no cubre toda la pantalla) y **se cierra solo apenas lee un código**, para poder seguir con el resto del formulario sin que la cámara estorbe.
* **Auto-Login:** doble clic sobre la tarjeta de inicio de sesión rellena las credenciales de acceso rápido.
* **Cálculo de Vuelto/Cambio:** automático en tiempo real al ingresar el efectivo del cliente.
* **Registro Masivo de Productos:** herramienta aparte para dar de alta muchos productos escaneando código por código, con exportación a CSV compatible con el Importador.
* **Modo Mantenimiento:** permite bloquear el acceso al sistema para todos los dispositivos mientras se hacen cambios, y desactivarlo con contraseña.
* **Historial de Versiones:** insignia en la barra lateral que muestra los cambios de cada versión del sistema.
* **Diseño Responsivo y Dark Mode:** adaptable a pantallas pequeñas, con menú lateral colapsable y tablas con scroll horizontal.
* **Feedback Visual Inmediato:** parpadeo verde de éxito, notificaciones (toasts) flotantes y spinner de carga.
* **Backend Serverless:** sin costos de hosting; los datos se guardan directamente en tu cuenta de Google Sheets.

---

## 📁 Estructura de Archivos

El proyecto se compone de páginas HTML autocontenidas (cada una trae su propio CSS y JS embebidos, sin archivos sueltos que enlazar) más el backend de Google Apps Script.

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| `index.html` | Frontend principal | Toda la aplicación: Login, Ventas (POS), Inventario, Registro de Producto, Categorías, Compras, Reportes, Papelera, Importador, Soporte y Ajustes. HTML, CSS y JS van en el mismo archivo. |
| `registro-masivo.html` | Frontend auxiliar | Página independiente para dar de alta muchos productos en fila usando la cámara. Se abre desde **Importador → Registro de Productos para Base de Datos**. Comparte la misma `SCRIPT_URL` que `index.html`. |
| `instructivo.md` | Documentación | Este archivo. Debe vivir en la **misma carpeta** que `index.html` para que el botón **Soporte → Instructivo** pueda leerlo y mostrarlo dentro de la app. |
| Código de `Apps Script` (`.gs`) | Backend | Vive dentro de tu Google Sheet (Extensiones → Apps Script). Recibe las peticiones de ambas páginas HTML y lee/escribe la base de datos. |

> Ambos archivos HTML cargan librerías externas por CDN (Font Awesome, `html5-qrcode` para el escáner, `xlsx` y `jsPDF` para exportar reportes, y `marked`/`DOMPurify` para renderizar este instructivo), así que necesitas conexión a internet la primera vez que se cargan.

---

## 📦 Módulos del Sistema

| Módulo | Funcionalidad |
| :--- | :--- |
| 🛒 **Ventas (POS)** | Búsqueda por nombre o escáner de cámara. Auto-suma al detectar coincidencia exacta. Calculadora de pago y cambio/vuelto. |
| 📦 **Inventario** | Visualización del stock, precios de compra/venta y códigos. Buscador en tiempo real, también con escáner. |
| ➕ **Reg. Producto** | Formulario para dar de alta un artículo nuevo. Permite usar la cámara para llenar el código de barras. |
| 🏷️ **Categorías** | Creación y listado rápido de categorías para organizar el inventario. |
| 🚚 **Compras** | Registro de entrada de mercadería; suma automáticamente la cantidad comprada al stock actual. |
| 📊 **Reportes** | Filtro de ventas por día (Hoy), semana o mes. Totales recaudados, historial de tickets y exportación a Excel/PDF. |
| 🗑️ **Papelera** | Historial de productos eliminados, con opción de restaurarlos al inventario activo. |
| 📥 **Importador** | Carga catálogos masivos desde `.csv` o `.json`, y enlaza a la herramienta de **Registro Masivo** para armar ese CSV escaneando producto por producto. |
| 🆘 **Soporte** | Envío de tickets de soporte, historial de reportes enviados, y el botón **Instructivo** que abre este documento dentro de la app. |
| 🛠️ **Ajustes** | Modo Oscuro/Claro, Modo Mantenimiento, y conexión/inicialización de la Base de Datos en Google Sheets. |

---

## ⚡ Guía de Uso Rápido

### Atajo de Inicio de Sesión
En la pantalla de Login, haz **doble clic sobre la tarjeta blanca** para que el sistema rellene automáticamente las credenciales de acceso rápido y te dé acceso instantáneo.

### Cobro y Cambio
En el POS, una vez tengas productos en el carrito:
1. Revisa el monto total.
2. En la casilla **"Pago con ($):"**, escribe cuánto dinero entregó el cliente.
3. La casilla roja de **Cambio / Vuelto** se calcula sola.
4. Presiona **Registrar Cobro Exitoso**.

### Ver este instructivo dentro del sistema
1. Ve al módulo **Soporte**.
2. Presiona el botón **Instructivo** junto al título.
3. El sistema carga `instructivo.md` (debe estar en la misma carpeta que `index.html`) y lo muestra ya formateado, sin salir de la app.

---

## 📷 Escáner de Código de Barras

* El botón con el ícono de **cámara** abre el mismo lector en Ventas, Inventario, Reg. Producto y Registro Masivo.
* El visor tiene un tamaño acotado pensado para móvil: no ocupa toda la pantalla, y el modal siempre deja visibles los botones de cerrar/capturar.
* En cuanto detecta un código válido: suena un bip, llena el campo correspondiente y **la cámara se cierra sola** — así puedes seguir completando el resto del formulario sin la cámara estorbando. Para escanear el siguiente código, vuelve a tocar el botón de cámara.
* Incluye controles de brillo/contraste/nitidez/escala de grises y captura de foto manual como respaldo para cámaras (sobre todo webcams de laptop) que tardan en enfocar.
* Si la cámara no arranca, el modal muestra el motivo (permiso denegado, sin cámara detectada, dispositivo ocupado, etc.) para poder diagnosticarlo sin abrir la consola del navegador.

---

## ⚙️ Instalación y Despliegue

1. Crea un nuevo archivo de **Google Sheets** en tu cuenta de Google Drive.
2. Copia el **ID de la hoja de cálculo** (la cadena larga de caracteres en la URL).
3. Ve a `Extensiones > Apps Script` en tu hoja de cálculo.
4. Pega el código del backend (`.gs`) ahí.
5. Reemplaza la variable `SPREADSHEET_ID = "AQUÍ_TU_ID";` con el ID que copiaste.
6. Haz clic en **Implementar > Nueva Implementación**. Selecciona tipo **Aplicación Web**, acceso "Cualquier persona".
7. Copia la URL de la aplicación web que te generará.
8. Pega esa URL en la constante `SCRIPT_URL` de **ambos** archivos: `index.html` y `registro-masivo.html`.
9. Sube `index.html`, `registro-masivo.html` e `instructivo.md` a la **misma carpeta** en tu hosting (o ábrelos a través de un servidor local; el botón Instructivo necesita `fetch()`, que no funciona abriendo el archivo con doble clic desde el explorador).
10. Abre `index.html` en el navegador y ve a **Ajustes > Conectar / Inicializar Hojas BD** para generar las tablas.

---

## 🔄 Flujo de Datos (Cómo funciona)

1. **Interacción del Usuario:** el usuario interactúa con la interfaz gráfica de `index.html` o `registro-masivo.html`.
2. **Procesamiento Local:** el JavaScript embebido procesa eventos (escanear, escribir, sumar al carrito) sin consultar al servidor hasta que es estrictamente necesario, para que la app se sienta rápida.
3. **Petición HTTP (Fetch):** al guardar un producto, cobrar una venta o enviar un ticket, la página empaqueta los datos en JSON y los envía a la URL de Google Apps Script (`SCRIPT_URL`).
4. **Respuesta del Servidor:** el backend en Apps Script intercepta la petición, localiza la fila/pestaña correspondiente en Google Sheets, actualiza los datos y devuelve `{"status": "success", "message": "..."}`.
5. **Feedback Visual:** el frontend recibe el *success*, dispara la animación de éxito, muestra el mensaje emergente y actualiza las tablas visibles en pantalla.

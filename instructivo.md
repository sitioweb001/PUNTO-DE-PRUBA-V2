# 🚀 ERP POS LITE

Sistema de Punto de Venta (POS) y Gestión de Inventario ligero, rápido y optimizado para dispositivos móviles y de escritorio. Construido con HTML, CSS y JavaScript puro (sin frameworks ni build), usando **Google Apps Script (Google Sheets)** como base de datos en la nube.

Este mismo instructivo está integrado dentro del sistema: se puede abrir en cualquier momento desde **Soporte → Instructivo**, sin salir de la aplicación.

> **Versión 5.0:** `index.html` ahora es el **único** frontend principal del sistema. Se fusionaron aquí todos los módulos que antes vivían en un segundo sistema aparte (Clientes, Proveedores, Usuarios, Caja, Combos, Gastos, Devoluciones, Facturas y un Dashboard con gráficos), además de todo lo que ya existía (Ventas, Inventario, Hacienda, Responsables, modo sin conexión, etc.). `Code.gs` es igualmente el único backend: ya no hace falta mantener dos Apps Script por separado.

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
* **Cálculo de Vuelto/Cambio:** automático en tiempo real al ingresar el efectivo del cliente, ya con el descuento (manual o de un Combo) aplicado.
* **Interruptor "Imprimir ticket al cobrar":** en el Carrito, justo antes de cobrar, se puede activar o desactivar la impresión automática del ticket/factura en PDF. Se recuerda por dispositivo.
* **Ticket o Factura:** cada venta se puede emitir como Ticket simple o como Factura (con NIT/DUI y un correlativo interno — no es un DTE certificado ante el Ministerio de Hacienda).
* **Clientes y Proveedores:** catálogos reutilizables — al elegir un cliente en el Carrito o un proveedor en Compras, se autocompletan sus datos de contacto.
* **Caja:** apertura y cierre de turno con cálculo automático del monto esperado en efectivo y la diferencia contra lo contado realmente.
* **Combos:** paquetes de productos a precio fijo, con botones de "Combos rápidos" en Ventas.
* **Gastos y Devoluciones:** registro de egresos por categoría, y devoluciones de productos ya vendidos (restaura el stock automáticamente).
* **Dashboard:** gráficos de ventas por día y productos más vendidos, con tarjetas de resumen (ventas, gastos, ganancia estimada, stock bajo).
* **Usuarios:** además del acceso rápido "admin" de siempre, se pueden dar de alta cajeros/administradores adicionales.
* **Registro Masivo de Productos:** herramienta aparte para dar de alta muchos productos escaneando código por código, con exportación a CSV compatible con el Importador.
* **Modo Sin Conexión (Ventas + Inventario):** si se va el internet, el sistema no se bloquea. En Ventas se puede seguir cobrando anotando los productos a mano (con sugerencias automáticas si hay una copia local del inventario), y esas ventas quedan en una cola en el dispositivo hasta poder verificarlas contra la base de datos real cuando vuelva la conexión. En Inventario se puede seguir viendo/buscando el catálogo usando la última copia local guardada (`inventario.json`).
* **Base de Datos Local (`inventario.json`):** desde Inventario, el botón **Actualizar Base Local** descarga una copia del inventario real para poder consultarlo sin internet. En el `.exe` de escritorio se guarda solo, en el navegador se descarga y hay que moverlo a mano a la carpeta.
* **Historial de Versiones:** insignia en la barra lateral que muestra los cambios de cada versión del sistema.
* **Diseño Responsivo y Dark Mode:** adaptable a pantallas pequeñas, con menú lateral colapsable y tablas con scroll horizontal.
* **Feedback Visual Inmediato:** parpadeo verde de éxito, notificaciones (toasts) flotantes y spinner de carga.
* **Backend Serverless:** sin costos de hosting; los datos se guardan directamente en tu cuenta de Google Sheets.

---

## 📁 Estructura de Archivos

El proyecto se compone de páginas HTML autocontenidas (cada una trae su propio CSS y JS embebidos, sin archivos sueltos que enlazar) más el backend de Google Apps Script.

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| `index.html` | Frontend principal | **Toda** la aplicación: Login, Ventas (POS), Caja, Inventario, Registro de Producto, Categorías, Combos, Compras, Proveedores, Gastos, Clientes, Reportes, Facturas, Devoluciones, Papelera, Importador, Soporte, Responsables, Usuarios, Dashboard y Ajustes. HTML, CSS y JS van en el mismo archivo. |
| `registro-masivo.html` | Frontend auxiliar | Página independiente para dar de alta muchos productos en fila usando la cámara. Se abre desde **Importador → Registro de Productos para Base de Datos**. Comparte la misma `SCRIPT_URL` que `index.html`. Sigue siendo un archivo aparte a propósito. |
| `instructivo.md` | Documentación | Este archivo. Debe vivir en la **misma carpeta** que `index.html` para que el botón **Soporte → Instructivo** pueda leerlo y mostrarlo dentro de la app. |
| `app.py` / `app.exe` | Versión de escritorio | Abre `index.html` en una ventana nativa (sin navegador), usando la misma `SCRIPT_URL`. También expone el guardado/lectura automática de `inventario.json` en su propia carpeta. |
| `inventario.json` | Copia local (respaldo) | Se genera con el botón **Inventario → Actualizar Base Local**. Permite ver/buscar el catálogo y seguir vendiendo sin internet. No es obligatorio: si no existe, el sistema simplemente no podrá mostrar datos mientras esté sin conexión. |
| Código de `Apps Script` (`.gs`) | Backend | Vive dentro de tu Google Sheet (Extensiones → Apps Script). Es el **único** backend: recibe las peticiones de `index.html` y de `registro-masivo.html`, y lee/escribe todas las hojas de la base de datos (incluidas las nuevas de Clientes, Proveedores, Usuarios, Caja, Combos, Gastos y Devoluciones). |

> Ambos archivos HTML cargan librerías externas por CDN (Font Awesome, `html5-qrcode` para el escáner, `xlsx` y `jsPDF` para exportar reportes, `Chart.js` para el Dashboard, y `marked`/`DOMPurify` para renderizar este instructivo), así que necesitas conexión a internet la primera vez que se cargan.

---

## 📦 Módulos del Sistema

| Módulo | Funcionalidad |
| :--- | :--- |
| 📊 **Dashboard** | Gráficos de ventas por día y top de productos vendidos, con tarjetas de resumen (ventas, gastos, ganancia estimada, tickets, stock bajo) filtrables por rango de fechas. |
| 🛒 **Ventas (POS)** | Búsqueda por nombre o escáner de cámara. Auto-suma al detectar coincidencia exacta. Calculadora de pago y cambio/vuelto. Selector de cliente registrado, botones de Combos rápidos, método de pago, descuento manual, tipo de documento (Ticket/Factura) e interruptor de impresión automática. |
| 🗄️ **Caja** | Apertura de turno con monto inicial, cierre con monto real contado y cálculo automático de la diferencia contra lo esperado (según las ventas en efectivo de ese turno). Historial de todos los turnos. |
| 📦 **Inventario** | Visualización del stock, precios de compra/venta y códigos. Buscador en tiempo real, también con escáner. Botón **Actualizar Base Local** para generar `inventario.json` y poder consultarlo sin internet. |
| ➕ **Reg. Producto** | Formulario para dar de alta un artículo nuevo. Permite usar la cámara para llenar el código de barras. |
| 🏷️ **Categorías** | Creación y listado rápido de categorías para organizar el inventario. |
| 🎁 **Combos** | Arma paquetes de varios productos a un precio fijo. Aparecen en Ventas como botones de "Combos rápidos". |
| 🚚 **Compras** | Registro de entrada de mercadería; suma automáticamente la cantidad comprada al stock actual. Permite elegir un proveedor ya registrado para autocompletar sus datos. |
| 🏭 **Proveedores** | Catálogo de proveedores (nombre, contacto, dirección, notas), reutilizable desde Compras. |
| 💸 **Gastos** | Registro de egresos del negocio por categoría (servicios, alquiler, salarios, etc.), con total histórico. |
| 📇 **Clientes** | Catálogo de clientes (nombre, contacto, NIT/DUI, dirección), reutilizable desde el Carrito para autocompletar sus datos al cobrar. |
| 📊 **Reportes** | Filtro de ventas por día (Hoy), semana o mes. Totales recaudados, historial de tickets y exportación a Excel/PDF. |
| 🧾 **Facturas** | Listado de ventas emitidas como "Factura" (con NIT/DUI y correlativo interno) en vez de Ticket simple, con opción de reimprimir el PDF. |
| ↩️ **Devoluciones** | Devuelve productos de una venta ya registrada (se busca por ID de venta) y restaura el stock automáticamente. |
| 🗑️ **Papelera** | Historial de productos eliminados, con opción de restaurarlos al inventario activo. |
| 📥 **Importador** | Carga catálogos masivos desde `.csv` o `.json`, y enlaza a la herramienta de **Registro Masivo** para armar ese CSV escaneando producto por producto. |
| 🆘 **Soporte** | Envío de tickets de soporte, historial de reportes enviados, y el botón **Instructivo** que abre este documento dentro de la app. |
| 📤 **Responsables** | Personas que reciben reportes automáticos por correo (mensual, anual, ventas grandes, stock bajo, backups). |
| 👥 **Usuarios** | Da de alta cajeros/administradores adicionales, cada uno con su propio usuario, contraseña y rol. El acceso rápido "admin" de siempre sigue funcionando igual. |
| 🛠️ **Ajustes** | Modo Oscuro/Claro, Modo Mantenimiento, y conexión/inicialización de la Base de Datos en Google Sheets. |

---

## 🔌 Modo Sin Conexión (Ventas + Inventario)

### ¿Qué pasa si se va el internet?
El sistema detecta la pérdida de conexión real (no solo el wifi de la PC, sino si realmente llega a internet) y avisa con una franja roja. A partir de ahí:

* **Inventario:** en vez de quedar en blanco, se muestra la última copia local guardada (`inventario.json`), con un aviso indicando de qué fecha es esa copia. Los precios/existencias podrían no estar 100% al día.
* **Ventas:** el buscador normal se reemplaza por un formulario para anotar el producto a mano (nombre, cantidad y precio aproximado). Si hay una copia local del inventario cargada, aparecen sugerencias con el precio y stock real mientras escribís, igual que el buscador normal — así casi nunca hace falta escribir el precio a ojo.
* Cada venta hecha sin conexión queda guardada **en ese dispositivo** (no se pierde), lista para verificar cuando vuelva internet.

### Cuando vuelve la conexión
Aparece un panel con las ventas pendientes de esa sesión sin internet. Al abrir cada una:

* Si el producto anotado ya se había emparejado con uno real (porque se eligió de las sugerencias), se empareja solo.
* Si no, se busca a mano contra el inventario real, se confirma el precio correcto y el pago/cambio, y ahí sí se registra la venta de verdad en Google Sheets (descontando el stock).

### Generar/actualizar la copia local (`inventario.json`)
1. Con internet, ve a **Inventario** y presiona **Actualizar Base Local**.
2. Confirma el mensaje que aparece.
3. El sistema descarga el inventario completo y actualizado:
   * **Usando el `.exe` de escritorio:** se guarda automáticamente en la misma carpeta del programa, reemplazando la copia anterior si existía.
   * **Usando el sistema desde un navegador:** el archivo `inventario.json` se descarga (normalmente a la carpeta de Descargas). Hay que moverlo a mano a la misma carpeta donde está `index.html`, reemplazando el archivo anterior, para que quede disponible la próxima vez que falte internet.
4. Si nunca se generó una copia local y se pierde la conexión, el sistema avisa que no hay datos locales disponibles y que hace falta conectarse a internet al menos una vez para generarla.

> 💡 Conviene actualizar la base local de vez en cuando (por ejemplo, al abrir el negocio cada día), sobre todo si los precios o el stock cambian seguido.

---

## ⚡ Guía de Uso Rápido

### Atajo de Inicio de Sesión
En la pantalla de Login, haz **doble clic sobre la tarjeta blanca** para que el sistema rellene automáticamente las credenciales de acceso rápido y te dé acceso instantáneo.

### Cobro y Cambio
En el POS, una vez tengas productos en el carrito:
1. Revisa el monto total.
2. En la casilla **"Pago con ($):"**, escribe cuánto dinero entregó el cliente.
3. La casilla roja de **Cambio / Vuelto** se calcula sola.
4. Elige si el documento a emitir es **Ticket simple** o **Factura** (esta última pide NIT/DUI y le asigna un correlativo interno).
5. El interruptor **"Imprimir ticket al cobrar"** decide si, al presionar el botón de abajo, se abre automáticamente el PDF listo para imprimir. Se puede desactivar si no quieres imprimir cada venta.
6. Presiona **Registrar Cobro Exitoso**.

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

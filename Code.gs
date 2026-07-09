// ═══════════════════════════════════════════════════════════════
// ERP POS LITE v5.0 — BACKEND UNIFICADO COMPLETO
// Fusiona el backend original (Ventas/Productos/Hacienda/Responsables)
// con los módulos del segundo sistema: Clientes, Proveedores, Usuarios,
// Caja, Combos, Gastos, Devoluciones y Facturas internas.
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = "1g1jENAm0IxzPZ69Gk-KrEZvpfsjOitW31OrgrkKZaoU"; 

const H_CATEGORIAS   = "Categorias";
const H_PRODUCTOS    = "Productos";
const H_COMPRAS      = "Compras";
const H_VENTAS       = "Ventas";
const H_VENTA_DET    = "VentaDetalle";
const H_PAPELERA     = "Papelera";
const H_ACTIVIDAD    = "Actividad";
const H_SOPORTE      = "Soporte";
const H_HACIENDA     = "HaciendaArchivos";
const H_RESPONSABLES = "Responsables";
const H_CLIENTES     = "Clientes";
const H_PROVEEDORES  = "Proveedores";
const H_USUARIOS     = "Usuarios";
const H_CAJA         = "Caja";
const H_COMBOS       = "Combos";
const H_COMBO_DET    = "ComboDetalle";
const H_GASTOS       = "Gastos";
const H_DEVOLUCIONES = "Devoluciones";

// ── MANTENIMIENTO ── (guardado en PropertiesService, no en hoja)
function getModoMantenimiento() {
  return PropertiesService.getScriptProperties().getProperty('mantenimiento') === 'true';
}
function setModoMantenimiento(valor) {
  PropertiesService.getScriptProperties().setProperty('mantenimiento', valor ? 'true' : 'false');
}

// ── CÓDIGOS DE BARRAS: IGNORAR CEROS A LA IZQUIERDA ── (PropertiesService)
// PROBLEMA QUE RESUELVE: Google Sheets interpreta un código como
// "000753081010115" como un NÚMERO al guardarlo (por eso el campo "código"
// llega vacío de ceros a la izquierda: queda "753081010115"). El lector de
// código de barras / pistola, en cambio, SIEMPRE envía el código completo
// tal como está impreso, con sus ceros originales. Al buscar ese código
// exacto contra lo guardado (sin ceros), la búsqueda fallaba en Ventas,
// Compras, Inventario, el editor de hoja, etc.
//
// Con esta opción ACTIVADA (interruptor verde en Ajustes), toda comparación
// de códigos en el backend ignora los ceros a la izquierda de ambos lados
// (el guardado y el buscado), sin importar cuántos sean. Con la opción
// DESACTIVADA (rojo), se mantiene la comparación exacta de siempre.
function getConfigIgnorarCeros() {
  return PropertiesService.getScriptProperties().getProperty('ignorarCerosCodigo') === 'true';
}
function setConfigIgnorarCeros(valor) {
  PropertiesService.getScriptProperties().setProperty('ignorarCerosCodigo', valor ? 'true' : 'false');
}
// Quita los ceros a la izquierda de un código sin importar cuántos sean.
// Si el código son puros ceros, deja al menos uno (no lo vacía).
function normalizarCodigo_(codigo) {
  return String(codigo == null ? '' : codigo).trim().replace(/^0+(?=.)/, '').toLowerCase();
}

// ── EVITAR CÓDIGOS CHOCADOS (dos productos activos con el mismo código) ──
// PROBLEMA QUE RESUELVE: antes no existía NINGÚN control que impidiera
// guardar un producto con un código que ya usa otro (por ejemplo, un código
// corto asignado a mano como "22" para un producto sin código de barras
// real). Si eso pasaba, el lector de código de barras / la búsqueda se
// quedaban con el PRIMER producto que encontraban con ese código —
// normalmente el más viejo — y por eso un escaneo podía terminar
// registrando un producto totalmente distinto al que se escaneó
// (ej. "escaneo algo y me registra un jabón").
// Esta función revisa, contra todos los productos ACTIVOS, si el código
// nuevo ya está en uso. Si el interruptor "ignorar ceros a la izquierda"
// está activado, la comparación también ignora esos ceros de ambos lados,
// igual que hace la búsqueda real (findRow / normalizarCodigo_), para que
// el chequeo detecte exactamente los mismos choques que vería el lector.
function codigoColisiona_(codigoNuevo, idExcluir) {
  const codStr = String(codigoNuevo == null ? '' : codigoNuevo).trim();
  if (!codStr) return null; // código vacío: no se puede chocar contra nada
  const ignorarCeros = getConfigIgnorarCeros();
  const codNorm = ignorarCeros ? normalizarCodigo_(codStr) : codStr.toLowerCase();
  const hoja = sh(H_PRODUCTOS);
  if (!hoja || hoja.getLastRow() < 2) return null;
  const vals = hoja.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    const activo = vals[i][10];
    if (!(activo === true || activo === 'true')) continue; // los inactivos/eliminados no cuentan
    if (idExcluir && String(vals[i][0]) === String(idExcluir)) continue; // no chocar contra sí mismo al editar
    const otro = String(vals[i][2] == null ? '' : vals[i][2]).trim();
    if (!otro) continue;
    const otroNorm = ignorarCeros ? normalizarCodigo_(otro) : otro.toLowerCase();
    if (otroNorm === codNorm) return { id: vals[i][0], nombre: vals[i][1], codigo: otro };
  }
  return null;
}

// ── REPORTE DE CÓDIGOS DUPLICADOS ──
// Agrupa los productos ACTIVOS que comparten el mismo código de barras,
// usando el mismo criterio de comparación que usa el sistema en vivo
// (exacto, o ignorando ceros a la izquierda si esa opción está activada en
// Ajustes › Validación de Código de Barras). Los productos sin código no
// se consideran entre sí, porque un código vacío no "choca" contra otro.
// Esto sirve para encontrar duplicados que ya existían ANTES de que
// codigoColisiona_() empezara a bloquear los nuevos (por ejemplo, productos
// cargados por un lote antiguo, o editados directamente en la hoja).
function getCodigosDuplicados() {
  const ignorarCeros = getConfigIgnorarCeros();
  const productos = (getData(H_PRODUCTOS).data || []).filter(p => p.activo === true || p.activo === 'true');
  const grupos = {};
  productos.forEach(p => {
    const codigo = String(p['código'] == null ? '' : p['código']).trim();
    if (!codigo) return;
    const clave = ignorarCeros ? normalizarCodigo_(codigo) : codigo.toLowerCase();
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push({ id: p.id, nombre: p.nombre, codigo: codigo, categoria: p['categoría'], stock: p.stock, precio_compra: p.precio_compra, precio_venta: p.precio_venta });
  });
  const duplicados = Object.keys(grupos).map(k => grupos[k]).filter(g => g.length > 1);
  duplicados.sort((a, b) => b.length - a.length);
  return {
    status: 'success',
    data: duplicados,
    total_grupos: duplicados.length,
    total_productos: duplicados.reduce((s, g) => s + g.length, 0)
  };
}

const HDR = {
  Categorias:    ["id","nombre","emoji","activo"],
  Productos:     ["id","nombre","código","categoría","precio_compra","precio_venta","stock","stock_minimo","imagen_url","favorito","activo","fecha_creado","proveedor_nombre","proveedor_whatsapp","proveedor_correo","proveedor_fecha_entrada"],
  Compras:       ["id","producto_id","cantidad","precio_compra","fecha","usuario","notas","proveedor_id"],
  // Las últimas 7 columnas (desde metodo_pago) se agregaron en v5.0. Se
  // agregan SIEMPRE al final para no romper las filas de ventas ya
  // existentes (crearHoja() solo añade encabezados que falten, nunca
  // reordena columnas). Todo lo nuevo es opcional: una venta sin caja
  // abierta, sin cliente registrado o sin factura sigue funcionando igual
  // que antes.
  Ventas:        ["id","fecha","cliente_nombre","cliente_whatsapp","cliente_correo","subtotal","descuento","impuesto","total","pago_con","cambio","usuario","estado","metodo_pago","cliente_id","numero_factura","tipo_documento","cliente_nit","cliente_direccion","caja_id"],
  VentaDetalle:  ["id","venta_id","producto_id","producto_nombre","cantidad","precio_unitario","descuento_linea","subtotal_linea"],
  Papelera:      ["id","tipo","datos_originales","fecha_eliminado","eliminado_por"],
  Actividad:     ["id","fecha","usuario","accion","detalle"],
  Soporte:       ["id","usuario","titulo","descripcion","estado","fecha","fecha_actualizado","respuesta","admin"],
  HaciendaArchivos: ["id","categoria","nombre_archivo","tipo_archivo","contenido_base64","tamano_bytes","fecha","usuario"],
  Responsables:  ["id","email","nombre","reportes","umbral_venta_grande","activo","ultimo_envio_mensual","ultimo_envio_anual","ultimo_envio_stock","fecha_creado","ultimo_envio_backup"],
  // ── Módulos nuevos v5.0 (fusionados del segundo sistema) ──
  Clientes:      ["id","nombre","telefono","correo","direccion","nit_dui","activo","fecha_creado"],
  Proveedores:   ["id","nombre","telefono","correo","direccion","notas","activo","fecha_creado"],
  Usuarios:      ["id","nombre","usuario","password","rol","activo","fecha_creado"],
  Caja:          ["id","fecha_apertura","monto_apertura","fecha_cierre","monto_cierre_esperado","monto_cierre_real","diferencia","usuario_apertura","usuario_cierre","estado","notas"],
  Combos:        ["id","nombre","precio_combo","activo","fecha_creado"],
  ComboDetalle:  ["id","combo_id","producto_id","cantidad"],
  Gastos:        ["id","fecha","concepto","monto","categoria","usuario","notas"],
  Devoluciones:  ["id","venta_id","producto_id","producto_nombre","cantidad","motivo","fecha","usuario","monto_devuelto"]
};

// ── RESPONSABLES — tipos de reporte disponibles ──
// 'mensual'        : resumen de ventas/compras del mes anterior (se envía automáticamente el día 1, o manualmente).
// 'anual'          : resumen anual de ventas/compras (se envía automáticamente el 1-ene, o manualmente).
// 'ventas_grandes' : aviso inmediato cuando una venta supera su "umbral_venta_grande".
// 'stock_bajo'     : aviso diario si hay productos con stock bajo/agotado.
// 'backup_json'    : copia de seguridad diaria completa del sistema, adjunta en un .json.
// 'backup_csv'     : copia de seguridad diaria completa del sistema, adjunta en un .zip con varios .csv.
const REPORTES_DISPONIBLES = ['mensual', 'anual', 'ventas_grandes', 'stock_bajo', 'backup_json', 'backup_csv'];

function ss()  { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function uid() { return 'id-' + (Date.now().toString(36) + Math.random().toString(36).substring(2,9)).toUpperCase(); }
function sh(n) { return ss().getSheetByName(n); }
function resp(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function log(usuario, accion, detalle) { try { sh(H_ACTIVIDAD).appendRow([uid(), new Date(), usuario||'Sistema', accion, detalle||'']); } catch(e){} }

function getData(nombre) {
  const hoja = sh(nombre);
  if (!hoja || hoja.getLastRow() < 2) return { status:'error', message:`'${nombre}' vacía.` };
  const vals = hoja.getDataRange().getValues();
  const heads = vals[0];
  const rows = vals.slice(1).map(r => {
    const o = {}; heads.forEach((h, i) => { o[h] = (r[i] instanceof Date) ? r[i].toISOString() : (r[i] === '' || r[i] == null ? '' : r[i]); });
    return o;
  }).filter(r => Object.values(r).some(v => v !== ''));
  return { status:'success', data: rows };
}

function findRow(hoja, id) {
  const vals = hoja.getDataRange().getValues();
  const idStr = String(id).toLowerCase();
  const ignorarCeros = getConfigIgnorarCeros();
  const idNorm = ignorarCeros ? normalizarCodigo_(id) : null;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).toLowerCase() === idStr || String(vals[i][2]).toLowerCase() === idStr) return { row: vals[i], idx: i };
    // Con la opción activada, si no hubo match exacto, se intenta de nuevo
    // ignorando los ceros a la izquierda del código guardado y del buscado
    // (soluciona el caso en que Google Sheets ya le quitó los ceros al
    // código guardado, pero el lector de código de barras envía el código
    // completo con sus ceros originales).
    if (ignorarCeros && idNorm !== '' && normalizarCodigo_(vals[i][2]) === idNorm) return { row: vals[i], idx: i };
  }
  return { row: null, idx: -1 };
}

function crearHoja(nombre) {
  const spreadsheet = ss();
  if (!HDR[nombre]) return;
  let hoja = spreadsheet.getSheetByName(nombre);
  if (!hoja) hoja = spreadsheet.insertSheet(nombre);
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1,1,1,HDR[nombre].length).setValues([HDR[nombre]]);
    hoja.setFrozenRows(1);
    return;
  }
  // La hoja ya existía de una versión anterior del sistema: agrega al final
  // las columnas nuevas que falten (por nombre de encabezado), sin tocar ni
  // reordenar las columnas ni los datos existentes. Esto es lo que permite
  // que "Inicializar / Sincronizar BD" agregue campos nuevos (como los de
  // Responsables) a una base de datos que ya tenía filas.
  const anchoActual = hoja.getLastColumn();
  const encabezados = anchoActual > 0 ? hoja.getRange(1, 1, 1, anchoActual).getValues()[0].map(String) : [];
  const faltantes = HDR[nombre].filter(campo => !encabezados.includes(campo));
  if (faltantes.length) {
    hoja.getRange(1, anchoActual + 1, 1, faltantes.length).setValues([faltantes]);
  }
  if (nombre === H_PRODUCTOS) forzarColumnaTextoCodigo_();
}

// ── CAUSA RAÍZ del problema de los ceros a la izquierda ──
// Por defecto, una celda de Google Sheets "adivina" el tipo de dato: si el
// texto que se guarda parece un número (como "000753081010115"), Sheets lo
// convierte a número de verdad y borra los ceros a la izquierda porque
// numéricamente no significan nada (0007 = 7). Esto pasa SIN IMPORTAR cómo
// se mande el dato desde el sistema (agregarProducto, editarProducto,
// importarDatos): si la celda no está formateada como "texto plano", Sheets
// hace la conversión igual.
//
// Este método fuerza la columna "código" (columna C) de Productos a formato
// de Texto Plano ("@"), para TODAS las filas presentes y varias filas de
// más por delante. Con la columna ya en texto, cualquier código nuevo que
// se guarde (aunque empiece en "0") se conserva tal cual, con todos sus
// ceros. Se ejecuta automáticamente cada vez que se crea la hoja o se corre
// "Inicializar / Sincronizar BD" en Ajustes.
//
// IMPORTANTE: esto solo protege los códigos que se guarden DE AHORA EN
// ADELANTE. No puede "adivinar" ni recuperar cuántos ceros tenía un código
// que ya se guardó y ya perdió esos ceros (ese dato ya se perdió). Para los
// códigos ya existentes que perdieron sus ceros, la solución es el
// interruptor "Buscar ignorando ceros a la izquierda" en Ajustes.
function forzarColumnaTextoCodigo_() {
  try {
    const hoja = sh(H_PRODUCTOS);
    if (!hoja) return;
    const filasNecesarias = Math.max(hoja.getLastRow() + 500, 2000);
    hoja.getRange(2, 3, filasNecesarias - 1, 1).setNumberFormat('@');
  } catch (e) {}
}

function doGet(e) {
  const p = e.parameter; let r;
  try {
    // Acciones que siempre pasan (consulta de estado y control de mantenimiento)
    const accionesSistema = ['getEstado', 'activarMantenimiento', 'desactivarMantenimiento', 'iniciar', 'resetear'];
    if (!accionesSistema.includes(p.action) && getModoMantenimiento()) {
      return resp({status:'mantenimiento', message:'Sistema en mantenimiento. Intente más tarde.'});
    }
    switch(p.action) {
      case 'getEstado':            r = {status:'success', mantenimiento: getModoMantenimiento()}; break;
      case 'getConfigCodigoBarras': r = {status:'success', activo: getConfigIgnorarCeros()}; break;
      case 'activarMantenimiento': setModoMantenimiento(true);  log('Sistema','Mantenimiento','Activado');  r = {status:'success', message:'Mantenimiento activado.'}; break;
      case 'desactivarMantenimiento': setModoMantenimiento(false); log('Sistema','Mantenimiento','Desactivado'); r = {status:'success', message:'Mantenimiento desactivado.'}; break;
      case 'iniciar':   r = iniciarBD(); break;
      case 'resetear':  r = resetearBD(); break;
      case 'getCategorias': r = getData(H_CATEGORIAS); break;
      case 'getInventario': r = {status:'success', data: (getData(H_PRODUCTOS).data || []).filter(x => x.activo === true || x.activo === 'true' || x.activo === 1)}; break;
      case 'getCodigosDuplicados': r = getCodigosDuplicados(); break;
      case 'getVentas': r = getVentasConDetalle(p.fecha_inicio, p.fecha_fin); break;
      case 'getReporte': r = getReporte(p.tipo, p.fecha_inicio, p.fecha_fin); break;
      case 'getPapelera': r = getData(H_PAPELERA); break;
      case 'getActividad': r = getData(H_ACTIVIDAD); break;
      case 'getSoporte': r = getData(H_SOPORTE); break;
      case 'getArchivosHacienda': r = getArchivosHacienda(p.categoria); break;
      case 'descargarArchivoHacienda': r = descargarArchivoHacienda(p.id); break;
      case 'getResponsables': r = getData(H_RESPONSABLES); break;
      case 'ejecutarEnvioProgramado': r = enviarReportesProgramados(); break;
      case 'getEmpresa':      r = getEmpresa(); break;
      case 'getClientes':     r = getData(H_CLIENTES); break;
      case 'getProveedores':  r = getData(H_PROVEEDORES); break;
      case 'getUsuarios':     r = getUsuarios(); break;
      case 'getCajaActual':   r = getCajaActual(); break;
      case 'getCajaHistorial':r = getCajaHistorial(); break;
      case 'getCombos':       r = getCombos(); break;
      case 'getGastos':       r = getData(H_GASTOS); break;
      case 'getDevoluciones': r = getData(H_DEVOLUCIONES); break;
      case 'getDashboard':    r = getDashboard(p.fecha_inicio, p.fecha_fin); break;
      default: r = {status:'error', message:`Acción '${p.action}' no válida.`};
    }
  } catch(ex) { r = {status:'error', message:ex.message}; }
  return resp(r);
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents); let r;
    // Bloquear todo POST excepto login cuando hay mantenimiento
    if (req.action !== 'login' && getModoMantenimiento()) {
      return resp({status:'mantenimiento', message:'Sistema en mantenimiento. Intente más tarde.'});
    }
    switch(req.action) {
      case 'login': r = login(req); break;
      case 'agregarCategoria': sh(H_CATEGORIAS).appendRow([uid(), req.nombre, req.emoji||'📦', true]); r = {status:'success', message:'Categoría agregada con éxito.'}; break;
      case 'editarCategoria': r = editarCategoria(req); break;
      case 'eliminarCategoria': r = eliminarEntidad(H_CATEGORIAS, req, 'Categoría'); break;
      case 'agregarProducto': {
        const colisionAgregar = req.codigo ? codigoColisiona_(req.codigo, null) : null;
        if (colisionAgregar) {
          r = {status:'error', message:`Ese código ya lo tiene registrado "${colisionAgregar.nombre}" (código guardado: "${colisionAgregar.codigo}"). Usa un código distinto para que el lector no los confunda.`};
        } else {
          forzarColumnaTextoCodigo_();
          // El proveedor es opcional: si no se indica, esas columnas quedan
          // en blanco (igual que un producto registrado antes de que
          // existiera este campo) y se pueden completar después desde
          // Compras al ingresar mercadería de ese producto.
          sh(H_PRODUCTOS).appendRow([
            uid(), req.nombre, String(req.codigo||''), req.categoria, parseFloat(req.precio_compra)||0, parseFloat(req.precio_venta)||0,
            parseInt(req.stock)||0, parseInt(req.stock_minimo)||5, req.imagen_url||'', false, true, new Date(),
            req.proveedor_nombre||'', req.proveedor_whatsapp||'', '', req.proveedor_nombre ? new Date() : ''
          ]);
          r = {status:'success', message:'Producto registrado con éxito.'};
        }
        break;
      }
      case 'editarProducto': r = editarProducto(req); break;
      case 'eliminarProducto': r = eliminarProducto(req); break;
      case 'restaurarProducto': r = restaurarProducto(req); break;
      case 'registrarVenta': r = registrarVenta(req); break;
      case 'registrarCompra': r = registrarCompra(req); break;
      case 'importarDatos': r = importarDatos(req); break;
      case 'crearTicketSoporte': sh(H_SOPORTE).appendRow([uid(), req.usuario, req.titulo, req.descripcion, 'nuevo', new Date(), new Date(), '', '']); r = {status:'success', message:'Ticket de soporte creado.'}; break;
      case 'subirArchivoHacienda': r = subirArchivoHacienda(req); break;
      case 'eliminarArchivoHacienda': r = eliminarArchivoHacienda(req); break;
      case 'agregarResponsable': r = agregarResponsable(req); break;
      case 'editarResponsable': r = editarResponsable(req); break;
      case 'eliminarResponsable': r = eliminarEntidad(H_RESPONSABLES, req, 'Responsable'); break;
      case 'enviarReporteResponsable': r = enviarReporteResponsableManual(req); break;
      case 'enviarFacturaCliente': r = enviarFacturaCliente(req); break;
      case 'registrarEnvioWhatsapp': r = registrarEnvioWhatsapp(req); break;
      case 'guardarEmpresa':     r = guardarEmpresa(req); break;
      case 'agregarCliente':     r = agregarCliente(req); break;
      case 'editarCliente':      r = editarCliente(req); break;
      case 'eliminarCliente':    r = eliminarCliente(req); break;
      case 'agregarProveedor':   r = agregarProveedor(req); break;
      case 'editarProveedor':    r = editarProveedor(req); break;
      case 'eliminarProveedor':  r = eliminarProveedor(req); break;
      case 'agregarUsuario':     r = agregarUsuario(req); break;
      case 'editarUsuario':      r = editarUsuario(req); break;
      case 'toggleUsuario':      r = toggleUsuario(req); break;
      case 'eliminarUsuario':    r = eliminarUsuario(req); break;
      case 'abrirCaja':          r = abrirCaja(req); break;
      case 'cerrarCaja':         r = cerrarCaja(req); break;
      case 'agregarCombo':       r = agregarCombo(req); break;
      case 'editarCombo':        r = editarCombo(req); break;
      case 'eliminarCombo':      r = eliminarCombo(req); break;
      case 'agregarGasto':       r = agregarGasto(req); break;
      case 'eliminarGasto':      r = eliminarGasto(req); break;
      case 'registrarDevolucion':r = registrarDevolucion(req); break;
      case 'setConfigCodigoBarras':
        setConfigIgnorarCeros(!!req.activo);
        log(req.usuario || 'admin', 'Configuración', `Búsqueda de código de barras ignorando ceros a la izquierda: ${req.activo ? 'ACTIVADA' : 'DESACTIVADA'}`);
        r = {status:'success', message:'Configuración actualizada con éxito.', activo: getConfigIgnorarCeros()};
        break;
      default: r = {status:'error', message:'Acción no reconocida'};
    }
    return resp(r);
  } catch(ex) { return resp({status:'error', message:ex.message}); }
}

function login(data) {
  // Acceso rápido del dueño/administrador principal (siempre disponible,
  // sin importar lo que tenga o no la hoja de Usuarios, para que nunca se
  // pueda quedar bloqueado fuera del sistema).
  if (String(data.usuario).toLowerCase() === 'admin' && (String(data.password) === 'admin123' || String(data.pin) === 'admin123')) {
    log(data.usuario, 'Login', 'Sesión iniciada');
    return {status:'success', message:'Ingreso exitoso.', data:{id:'1', usuario:'admin', rol:'admin'}};
  }
  // Usuarios adicionales dados de alta en el módulo "Usuarios" (cajeros,
  // otros administradores, etc.), cada uno con su propio rol.
  const hoja = sh(H_USUARIOS);
  if (hoja && hoja.getLastRow() > 1) {
    const vals = hoja.getDataRange().getValues();
    const usuarioBuscado = String(data.usuario||'').trim().toLowerCase();
    for (let i = 1; i < vals.length; i++) {
      const [id, nombre, usuarioReg, password, rol, activo] = vals[i];
      if (String(usuarioReg).trim().toLowerCase() === usuarioBuscado && (activo === true || activo === 'true')) {
        if (String(password) === String(data.password) || String(password) === String(data.pin)) {
          log(usuarioReg, 'Login', 'Sesión iniciada');
          return {status:'success', message:'Ingreso exitoso.', data:{id:String(id), usuario:String(usuarioReg), nombre:String(nombre||''), rol:String(rol||'vendedor')}};
        }
        return {status:'error', message:'Credenciales de acceso incorrectas.'};
      }
    }
  }
  return {status:'error', message:'Credenciales de acceso incorrectas.'};
}

// Correlativo interno de facturas (independiente de la numeración oficial
// de Hacienda/DTE, que este sistema NO emite). Sirve para llevar un
// consecutivo propio del negocio cuando se marca una venta como "Factura"
// en vez de "Ticket". Se guarda en PropertiesService para que sobreviva
// entre ejecuciones y no dependa de contar filas de la hoja.
function siguienteNumeroFactura_() {
  const props = PropertiesService.getScriptProperties();
  const actual = parseInt(props.getProperty('correlativoFactura')) || 0;
  const siguiente = actual + 1;
  props.setProperty('correlativoFactura', String(siguiente));
  return 'F-' + String(siguiente).padStart(6, '0');
}

function registrarVenta(data) {
  const shV = sh(H_VENTAS); const shD = sh(H_VENTA_DET); const shP = sh(H_PRODUCTOS);
  let subtotal = 0;
  for (const item of data.items) {
    const {row, idx} = findRow(shP, item.producto_id);
    if (!row) return {status:'error', message:`Producto no encontrado.`};
    if ((parseInt(row[6])||0) < parseInt(item.cantidad)) return {status:'warning', message:`Stock insuficiente de ${row[1]}`};
    item._rowIdx = idx; item._nombre = row[1]; item._subtotal = (parseFloat(item.precio_unitario)*parseInt(item.cantidad));
    subtotal += item._subtotal;
  }
  // Descuento total de la venta (usado por Combos, para que el precio del
  // combo cuadre, y por descuentos manuales). Antes siempre quedaba en 0.
  const descuento = Math.max(0, parseFloat(data.descuento) || 0);
  const base = Math.max(0, subtotal - descuento);
  // IVA opcional: solo se calcula si Empresa tiene un iva_pct configurado
  // y la venta lo pide explícitamente (evita romper el comportamiento de
  // siempre, donde el precio ya incluye todo y no se desglosa impuesto).
  let impuesto = 0;
  if (data.calcular_iva) {
    const emp = getEmpresa().data || {};
    impuesto = Math.round(base * ((parseFloat(emp.iva_pct)||0) / 100) * 100) / 100;
  }
  const total = Math.round((base + impuesto) * 100) / 100;
  const ventaId = uid();
  // Cliente y datos de contacto: si no se proporcionan, quedan como 'N/A'.
  // El único dato obligatorio de la venta es el pago (pago_con/cambio).
  const nombreCliente   = data.cliente_nombre   && String(data.cliente_nombre).trim()   !== '' ? String(data.cliente_nombre).trim()   : 'N/A';
  const whatsappCliente = data.cliente_whatsapp && String(data.cliente_whatsapp).trim() !== '' ? String(data.cliente_whatsapp).trim() : 'N/A';
  const correoCliente   = data.cliente_correo   && String(data.cliente_correo).trim()   !== '' ? String(data.cliente_correo).trim()   : 'N/A';
  const metodoPago      = data.metodo_pago && String(data.metodo_pago).trim() !== '' ? String(data.metodo_pago).trim() : 'Efectivo';
  const esFactura        = data.tipo_documento === 'factura';
  const numeroFactura     = esFactura ? siguienteNumeroFactura_() : '';

  shV.appendRow([
    ventaId, new Date(), nombreCliente, whatsappCliente, correoCliente, subtotal, descuento, impuesto, total,
    data.pago_con||0, data.cambio||0, data.usuario||'Sistema', 'completada',
    metodoPago, data.cliente_id||'', numeroFactura, esFactura ? 'factura' : 'ticket',
    data.cliente_nit||'', data.cliente_direccion||'', data.caja_id||''
  ]);
  
  for (const item of data.items) {
    shD.appendRow([uid(), ventaId, item.producto_id, item._nombre, parseInt(item.cantidad), parseFloat(item.precio_unitario), 0, item._subtotal]);
    shP.getRange(item._rowIdx+1, 7).setValue((parseInt(shP.getRange(item._rowIdx+1, 7).getValue())||0) - parseInt(item.cantidad));
  }
  log(data.usuario, 'Venta', `Total: $${total}`);
  // Aviso inmediato a responsables suscritos a "ventas_grandes" si el total
  // de esta venta supera su umbral configurado. No debe romper la venta si
  // el envío de correo falla (cuota de Gmail, etc.), por eso va en try/catch.
  try { notificarVentaGrande(ventaId, total, nombreCliente, data.items.length); } catch(e) {}
  // Se devuelve el detalle completo de la venta recién creada para que el
  // frontend pueda ofrecer de inmediato el envío del ticket por WhatsApp o
  // correo (listado, PDF o ambos), imprimir el ticket/factura, o actualizar
  // el resumen de caja, sin necesidad de volver a consultar el servidor.
  return {
    status:'success', message: esFactura ? `Factura ${numeroFactura} registrada con éxito.` : 'Venta registrada con éxito.',
    data: {
      id: ventaId, fecha: new Date().toISOString(),
      cliente_nombre: nombreCliente, cliente_whatsapp: whatsappCliente, cliente_correo: correoCliente,
      subtotal: subtotal, descuento: descuento, impuesto: impuesto, total: total, pago_con: data.pago_con||0, cambio: data.cambio||0,
      metodo_pago: metodoPago, cliente_id: data.cliente_id||'', numero_factura: numeroFactura, tipo_documento: esFactura ? 'factura' : 'ticket',
      cliente_nit: data.cliente_nit||'', cliente_direccion: data.cliente_direccion||'', caja_id: data.caja_id||'',
      items: data.items.map(it => ({ producto_nombre: it._nombre, cantidad: parseInt(it.cantidad), precio_unitario: parseFloat(it.precio_unitario), subtotal_linea: it._subtotal }))
    }
  };
}

// Registra un ingreso de mercadería. Además de sumar al stock y dejar
// constancia en la hoja de Compras (como antes), ahora también:
//   - Actualiza el precio_compra del producto con el costo unitario de
//     este ingreso (así el producto siempre refleja el último costo).
//   - Si se envía precio_venta (opcional), también lo actualiza — útil
//     para ajustar el precio de venta justo cuando llega mercadería nueva.
//   - Si se envía información de proveedor (nombre/whatsapp/correo), la
//     guarda en el producto y marca la fecha de esta entrada como la
//     "última entrada" de ese proveedor. Si el producto no tenía
//     proveedor y se deja en blanco, simplemente se queda como N/A.
function registrarCompra(data) {
  const shP = sh(H_PRODUCTOS); const {row, idx} = findRow(shP, data.producto_id);
  if (!row) return {status:'error', message:'Producto no encontrado.'};
  const cantidad = parseInt(data.cantidad)||0;
  const precioCompra = parseFloat(data.precio_compra)||0;
  sh(H_COMPRAS).appendRow([uid(), data.producto_id, cantidad, precioCompra, new Date(), data.usuario||'Sistema', data.notas||'', data.proveedor_id||'']);
  shP.getRange(idx+1,7).setValue((parseInt(shP.getRange(idx+1,7).getValue())||0) + cantidad);
  shP.getRange(idx+1,5).setValue(precioCompra);
  if (data.precio_venta !== undefined && String(data.precio_venta).trim() !== '') {
    shP.getRange(idx+1,6).setValue(parseFloat(data.precio_venta)||0);
  }
  const provNombre = String(data.proveedor_nombre||'').trim();
  shP.getRange(idx+1,13).setValue(provNombre);
  shP.getRange(idx+1,14).setValue(String(data.proveedor_whatsapp||'').trim());
  shP.getRange(idx+1,15).setValue(String(data.proveedor_correo||'').trim());
  if (provNombre) shP.getRange(idx+1,16).setValue(new Date());
  log(data.usuario, 'Compra', `${row[1]} x${cantidad}`);
  return {status:'success', message:`Compra registrada con éxito. Inventario actualizado.`};
}

function editarProducto(data) {
  const hoja = sh(H_PRODUCTOS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'No encontrado.'};
  if (data.codigo) {
    const colisionEditar = codigoColisiona_(data.codigo, data.id);
    if (colisionEditar) return {status:'error', message:`Ese código ya lo tiene registrado "${colisionEditar.nombre}" (código guardado: "${colisionEditar.codigo}"). Usa un código distinto para que el lector no los confunda.`};
  }
  if (data.nombre) hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.precio_compra) hoja.getRange(idx+1, 5).setValue(parseFloat(data.precio_compra));
  if (data.precio_venta) hoja.getRange(idx+1, 6).setValue(parseFloat(data.precio_venta));
  if (data.stock !== undefined) hoja.getRange(idx+1, 7).setValue(parseInt(data.stock));
  if (data.categoria) hoja.getRange(idx+1, 4).setValue(data.categoria);
  if (data.codigo) { forzarColumnaTextoCodigo_(); hoja.getRange(idx+1, 3).setValue(String(data.codigo)); }
  log(data.usuario, 'Editar producto', data.nombre);
  return {status:'success', message:'Producto actualizado con éxito.'};
}

function editarCategoria(data) {
  const hoja = sh(H_CATEGORIAS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Categoría no encontrada.'};
  if (data.nombre) hoja.getRange(idx+1, 2).setValue(data.nombre);
  log(data.usuario, 'Editar categoría', data.nombre);
  return {status:'success', message:'Categoría actualizada con éxito.'};
}

function eliminarProducto(data) {
  const hoja = sh(H_PRODUCTOS); const papelera = sh(H_PAPELERA); const {row, idx} = findRow(hoja, data.id);
  if (idx > -1) {
    papelera.appendRow([uid(), 'Producto', JSON.stringify({id:row[0], nombre:row[1], código:row[2], categoría:row[3], precio_compra:row[4], precio_venta:row[5], stock:row[6]}), new Date(), data.usuario||'Sistema']);
    hoja.getRange(idx+1, 11).setValue(false);
    log(data.usuario, 'Eliminar producto', row[1]);
    return {status:'success', message:`Producto movido a papelera exitosamente.`};
  } return {status:'error', message:'No encontrado.'};
}

function restaurarProducto(data) {
  const shPap = sh(H_PAPELERA); const shProd = sh(H_PRODUCTOS);
  const rows = shPap.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.papelera_id)) {
      const orig = JSON.parse(rows[i][2]);
      const {idx} = findRow(shProd, orig.id);
      if (idx > -1) shProd.getRange(idx+1, 11).setValue(true);
      shPap.deleteRow(i+1);
      log(data.usuario, 'Restaurar producto', orig.nombre);
      return {status:'success', message:'Producto restaurado exitosamente.'};
    }
  } return {status:'error', message:'No encontrado en papelera.'};
}

function eliminarEntidad(hoja, data, tipo) {
  const hojaObj = sh(hoja); const {idx} = findRow(hojaObj, data.id);
  if (idx > -1) { hojaObj.deleteRow(idx+1); return {status:'success', message:`${tipo} eliminada con éxito.`}; }
  return {status:'error', message:'No encontrado.'};
}

function getReporte(tipo, fechaIni, fechaFin) {
  const fi = new Date(fechaIni || 0); fi.setHours(0,0,0,0);
  const ff = new Date(fechaFin || Date.now()); ff.setHours(23,59,59,999);
  if (tipo === 'ventas') {
    // Se reutiliza getVentasConDetalle() para que el reporte traiga también
    // los items (productos, cantidades, precios) de cada venta — antes este
    // bloque llamaba directamente a getData(H_VENTAS), que NO incluye el
    // detalle, y por eso el modal de "Detalle de Venta" y el Ticket PDF
    // mostraban "No hay detalle de productos disponible para esta venta".
    const con = getVentasConDetalle();
    if (con.status !== 'success') return con;
    const f = con.data.filter(v=>{const x=new Date(v.fecha);return x>=fi&&x<=ff;});
    return {status:'success', data:f, resumen:{total:f.reduce((s,v)=>s+(parseFloat(v.total)||0),0), tickets:f.length}};
  } else if (tipo === 'compras') {
    const d = getData(H_COMPRAS); if (d.status!=='success') return d;
    const f = d.data.filter(c=>{const x=new Date(c.fecha);return x>=fi&&x<=ff;});
    return {status:'success', data:f, resumen:{total:f.reduce((s,c)=>s+((parseFloat(c.precio_compra)*parseInt(c.cantidad))||0),0)}};
  }
  return {status:'error', message:'Tipo no soportado'};
}

function getVentasConDetalle(fechaIni, fechaFin) {
  const ventas = getData(H_VENTAS).data || [];
  const detalles = getData(H_VENTA_DET).data || [];
  return {status:'success', data: ventas.map(v => ({...v, items: detalles.filter(d => String(d.venta_id) === String(v.id))}))};
}

function importarDatos(data) {
  const resultados = [];
  let totalOk = 0;

  // Registro en lote de productos — tipo:'productos' + filas:[...].
  // (Usado tanto por el importador manual como por "registro-masivo.html").
  if (data.tipo === 'productos' && Array.isArray(data.filas) && data.filas.length) {
    let ok = 0, err = 0;
    const conflictos = [];
    forzarColumnaTextoCodigo_();
    const ignorarCeros = getConfigIgnorarCeros();
    // Códigos ya agregados EN ESTE MISMO LOTE (para detectar choques entre
    // dos productos nuevos que se están subiendo juntos, no solo contra lo
    // que ya había en la base de datos).
    const codigosDeEsteLote = [];
    data.filas.forEach(f => {
      const codStr = String(f.codigo || '').trim();
      let colision = null;
      if (codStr) {
        colision = codigoColisiona_(codStr, null);
        if (!colision) {
          const norm = ignorarCeros ? normalizarCodigo_(codStr) : codStr.toLowerCase();
          const chocaEnLote = codigosDeEsteLote.find(c => c.norm === norm);
          if (chocaEnLote) colision = { nombre: chocaEnLote.nombre, codigo: chocaEnLote.codigo };
        }
      }
      if (colision) {
        err++;
        conflictos.push(`"${f.nombre}" (código "${codStr}") choca con "${colision.nombre}" (código "${colision.codigo}")`);
        return;
      }
      try {
        sh(H_PRODUCTOS).appendRow([uid(), f.nombre, codStr, f.categoria||'', parseFloat(f.precio_compra)||0, parseFloat(f.precio_venta)||0, parseInt(f.stock)||0, 5, '', false, true, new Date()]);
        if (codStr) codigosDeEsteLote.push({ norm: ignorarCeros ? normalizarCodigo_(codStr) : codStr.toLowerCase(), nombre: f.nombre, codigo: codStr });
        ok++;
      } catch(e){ err++; }
    });
    let msgProductos = `Productos: ${ok} agregados${err ? `, ${err} con error` : ''}`;
    if (conflictos.length) msgProductos += `. NO se registraron por código repetido: ${conflictos.join(' | ')}`;
    resultados.push(msgProductos);
    totalOk += ok;
  }

  // Restauración de copia de seguridad completa (el .json que genera
  // "Exportar" con "Seleccionar todo"): además de productos, puede traer
  // categorías, ventas y papelera. Se evita duplicar registros que ya
  // existan (por nombre en categorías, por id en ventas y papelera).
  if (Array.isArray(data.categorias) && data.categorias.length) {
    const hoja = sh(H_CATEGORIAS);
    const existentes = (getData(H_CATEGORIAS).data || []).map(c => String(c.nombre||'').trim().toLowerCase());
    let ok = 0;
    data.categorias.forEach(c => {
      const nombre = String(c.nombre||'').trim();
      if (!nombre || existentes.includes(nombre.toLowerCase())) return;
      hoja.appendRow([uid(), nombre, c.emoji||'📦', true]);
      existentes.push(nombre.toLowerCase());
      ok++;
    });
    resultados.push(`Categorías: ${ok} restauradas`);
    totalOk += ok;
  }

  if (Array.isArray(data.ventas) && data.ventas.length) {
    const hoja = sh(H_VENTAS);
    const existentes = (getData(H_VENTAS).data || []).map(v => String(v.id));
    let ok = 0;
    data.ventas.forEach(v => {
      if (!v.id || existentes.includes(String(v.id))) return;
      hoja.appendRow([
        v.id, v.fecha ? new Date(v.fecha) : new Date(), v.cliente_nombre||'N/A', v.cliente_whatsapp||'N/A',
        v.cliente_correo||'N/A', parseFloat(v.subtotal)||0, parseFloat(v.descuento)||0, parseFloat(v.impuesto)||0,
        parseFloat(v.total)||0, parseFloat(v.pago_con)||0, parseFloat(v.cambio)||0, v.usuario||'Sistema', v.estado||'completada'
      ]);
      existentes.push(String(v.id));
      ok++;
    });
    resultados.push(`Ventas: ${ok} restauradas`);
    totalOk += ok;
  }

  if (Array.isArray(data.papelera) && data.papelera.length) {
    const hoja = sh(H_PAPELERA);
    const existentes = (getData(H_PAPELERA).data || []).map(p => String(p.id));
    let ok = 0;
    data.papelera.forEach(p => {
      if (!p.id || existentes.includes(String(p.id))) return;
      const datosOriginales = typeof p.datos_originales === 'string' ? p.datos_originales : JSON.stringify(p.datos_originales||{});
      hoja.appendRow([p.id, p.tipo||'Producto', datosOriginales, p.fecha_eliminado ? new Date(p.fecha_eliminado) : new Date(), p.eliminado_por||'Sistema']);
      existentes.push(String(p.id));
      ok++;
    });
    resultados.push(`Papelera: ${ok} restaurados`);
    totalOk += ok;
  }

  const detalle = resultados.length ? resultados.join(' | ') : 'El archivo no tenía filas nuevas para importar.';
  const nombreArchivo = data.nombre_archivo ? `Archivo: "${data.nombre_archivo}" — ` : '';
  log(data.usuario || 'admin', 'Importación', `${nombreArchivo}${detalle}`);
  return {status:'success', message: detalle};
}

// ── MINISTERIO DE HACIENDA — Archivos Generales (G) y Específicos (E) ──
// Los archivos se guardan en base64 directamente en la hoja de cálculo.
// Google Sheets tiene un límite de ~50,000 caracteres por celda, por lo
// que se restringe cada archivo a un tamaño prudente (~30 KB reales).
const HACIENDA_MAX_BASE64 = 45000;

function getArchivosHacienda(categoria) {
  const hoja = sh(H_HACIENDA);
  if (!hoja || hoja.getLastRow() < 2) return {status:'success', data:[]};
  const d = getData(H_HACIENDA);
  if (d.status !== 'success') return {status:'success', data:[]};
  let rows = d.data.map(r => ({
    id: r.id, categoria: r.categoria, nombre_archivo: r.nombre_archivo,
    tipo_archivo: r.tipo_archivo, tamano_bytes: r.tamano_bytes, fecha: r.fecha, usuario: r.usuario
  }));
  if (categoria) rows = rows.filter(r => r.categoria === categoria);
  rows.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  return {status:'success', data: rows};
}

function descargarArchivoHacienda(id) {
  const hoja = sh(H_HACIENDA);
  if (!hoja) return {status:'error', message:'No encontrado.'};
  const vals = hoja.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      const r = vals[i];
      return {status:'success', data:{ id:r[0], categoria:r[1], nombre_archivo:r[2], tipo_archivo:r[3], contenido_base64:r[4], tamano_bytes:r[5], fecha:r[6], usuario:r[7] }};
    }
  }
  return {status:'error', message:'Archivo no encontrado.'};
}

function subirArchivoHacienda(data) {
  if (!data.categoria || ['G','E'].indexOf(data.categoria) === -1) return {status:'error', message:'Categoría inválida (debe ser G o E).'};
  if (!data.nombre_archivo) return {status:'error', message:'Falta el nombre del archivo.'};
  if (!data.contenido_base64) return {status:'error', message:'Falta el contenido del archivo.'};
  if (data.contenido_base64.length > HACIENDA_MAX_BASE64) return {status:'error', message:'El archivo es demasiado grande. Límite aprox. 30 KB por restricción de Google Sheets.'};
  sh(H_HACIENDA).appendRow([uid(), data.categoria, data.nombre_archivo, data.tipo_archivo||'', data.contenido_base64, data.tamano_bytes||0, new Date(), data.usuario||'Sistema']);
  log(data.usuario, 'Hacienda - Subir archivo', `[${data.categoria}] ${data.nombre_archivo}`);
  return {status:'success', message:'Archivo subido con éxito.'};
}

function eliminarArchivoHacienda(data) {
  const hoja = sh(H_HACIENDA); const {idx} = findRow(hoja, data.id);
  if (idx > -1) {
    const nombre = hoja.getRange(idx+1, 3).getValue();
    hoja.deleteRow(idx+1);
    log(data.usuario, 'Hacienda - Eliminar archivo', nombre);
    return {status:'success', message:'Archivo eliminado con éxito.'};
  }
  return {status:'error', message:'No encontrado.'};
}

function iniciarBD() {
  [H_CATEGORIAS,H_PRODUCTOS,H_COMPRAS,H_VENTAS,H_VENTA_DET,H_PAPELERA,H_ACTIVIDAD,H_SOPORTE,H_HACIENDA,H_RESPONSABLES,
   H_CLIENTES,H_PROVEEDORES,H_USUARIOS,H_CAJA,H_COMBOS,H_COMBO_DET,H_GASTOS,H_DEVOLUCIONES].forEach(crearHoja);
  return {status:'success', message:'BD Lite inicializada correctamente.'};
}

// ═══════════════════════════════════════════════════════════════
// RESPONSABLES — correos que reciben reportes automáticos/manuales
// ═══════════════════════════════════════════════════════════════

function validarEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function agregarResponsable(data) {
  if (!validarEmail_(data.email)) return {status:'error', message:'Correo electrónico inválido.'};
  const reportes = Array.isArray(data.reportes) ? data.reportes.filter(r => REPORTES_DISPONIBLES.includes(r)).join(',') : '';
  sh(H_RESPONSABLES).appendRow([
    uid(), data.email.trim(), data.nombre || '', reportes,
    parseFloat(data.umbral_venta_grande) || 100, true, '', '', '', new Date(), ''
  ]);
  log(data.usuario, 'Responsable - Agregar', data.email);
  return {status:'success', message:'Responsable agregado con éxito.'};
}

function editarResponsable(data) {
  const hoja = sh(H_RESPONSABLES); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Responsable no encontrado.'};
  if (data.email) {
    if (!validarEmail_(data.email)) return {status:'error', message:'Correo electrónico inválido.'};
    hoja.getRange(idx+1, 2).setValue(data.email.trim());
  }
  if (data.nombre !== undefined) hoja.getRange(idx+1, 3).setValue(data.nombre);
  if (data.reportes !== undefined) {
    const reportes = Array.isArray(data.reportes) ? data.reportes.filter(r => REPORTES_DISPONIBLES.includes(r)).join(',') : '';
    hoja.getRange(idx+1, 4).setValue(reportes);
  }
  if (data.umbral_venta_grande !== undefined) hoja.getRange(idx+1, 5).setValue(parseFloat(data.umbral_venta_grande) || 100);
  if (data.activo !== undefined) hoja.getRange(idx+1, 6).setValue(data.activo === true || data.activo === 'true');
  log(data.usuario, 'Responsable - Editar', data.email || '');
  return {status:'success', message:'Responsable actualizado con éxito.'};
}

function enviarCorreo_(destinatario, asunto, cuerpoHtml) {
  MailApp.sendEmail({ to: destinatario, subject: asunto, htmlBody: cuerpoHtml });
}

function enviarCorreoConAdjunto_(destinatario, asunto, cuerpoHtml, adjunto) {
  MailApp.sendEmail({ to: destinatario, subject: asunto, htmlBody: cuerpoHtml, attachments: [adjunto] });
}

// ═══════════════════════════════════════════════════════════════
// COPIAS DE SEGURIDAD (JSON / CSV) — usadas por "Responsables"
// Reutilizan exactamente el mismo formato que genera "Exportar" en el
// frontend, para que el archivo recibido por correo se pueda volver a
// subir directamente en "Importar" si hace falta restaurar datos.
// ═══════════════════════════════════════════════════════════════
function csvEscape_(valor) {
  const s = (valor === null || valor === undefined) ? '' : String(valor);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function filasACSV_(headers, filas) {
  const lineas = [headers.map(csvEscape_).join(',')];
  filas.forEach(f => lineas.push(f.map(csvEscape_).join(',')));
  return '\uFEFF' + lineas.join('\r\n'); // BOM para que Excel abra bien los acentos
}

function construirDatosBackupCompleto_() {
  const productos = (getData(H_PRODUCTOS).data || []).filter(p => p.activo === true || p.activo === 'true');
  const categorias = getData(H_CATEGORIAS).data || [];
  const ventas = getData(H_VENTAS).data || [];
  const papelera = getData(H_PAPELERA).data || [];
  return { productos, categorias, ventas, papelera };
}

function construirBackupJSONBlob_() {
  const d = construirDatosBackupCompleto_();
  const inventario = d.productos.map(p => ({
    nombre: p.nombre || '', codigo: p['código'] || p.codigo || '', categoria: p['categoría'] || p.categoria || '',
    precio_compra: parseFloat(p.precio_compra) || 0, precio_venta: parseFloat(p.precio_venta) || 0, stock: parseInt(p.stock) || 0
  }));
  const backup = {
    generado: new Date().toISOString(), sistema: 'ERP POS LITE',
    inventario: inventario, filas: inventario, // "filas" = compatibilidad directa con el Importador
    ventas: d.ventas, categorias: d.categorias.map(c => ({ nombre: c.nombre || '' })), papelera: d.papelera
  };
  const fechaTag = new Date().toISOString().slice(0,10);
  return Utilities.newBlob(JSON.stringify(backup, null, 2), 'application/json', `Backup_ERP_${fechaTag}.json`);
}

function construirBackupCSVBlob_() {
  const d = construirDatosBackupCompleto_();
  const fechaTag = new Date().toISOString().slice(0,10);
  const blobs = [];
  blobs.push(Utilities.newBlob(filasACSV_(
    ['nombre','codigo','categoria','precio_compra','precio_venta','stock'],
    d.productos.map(p => [p.nombre||'', p['código']||p.codigo||'', p['categoría']||p.categoria||'', parseFloat(p.precio_compra)||0, parseFloat(p.precio_venta)||0, parseInt(p.stock)||0])
  ), 'text/csv', 'Inventario.csv'));
  blobs.push(Utilities.newBlob(filasACSV_(['nombre'], d.categorias.map(c => [c.nombre||''])), 'text/csv', 'Categorias.csv'));
  blobs.push(Utilities.newBlob(filasACSV_(
    ['id_venta','fecha','cliente','whatsapp','correo','subtotal','total','pago_con','cambio'],
    d.ventas.map(v => [v.id||'', v.fecha||'', v.cliente_nombre||'N/A', v.cliente_whatsapp||'N/A', v.cliente_correo||'N/A', parseFloat(v.subtotal)||0, parseFloat(v.total)||0, parseFloat(v.pago_con)||0, parseFloat(v.cambio)||0])
  ), 'text/csv', 'Ventas.csv'));
  blobs.push(Utilities.newBlob(filasACSV_(
    ['tipo','datos_originales','fecha_eliminado','eliminado_por'],
    d.papelera.map(p => [p.tipo||'', p.datos_originales||'', p.fecha_eliminado||'', p.eliminado_por||''])
  ), 'text/csv', 'Papelera.csv'));
  return Utilities.zip(blobs, `Backup_ERP_${fechaTag}.zip`);
}

// ═══════════════════════════════════════════════════════════════
// ENVÍO DE FACTURA AL CLIENTE (Punto de Venta / Reportes de Ventas)
// ═══════════════════════════════════════════════════════════════
// El envío por WhatsApp se dispara enteramente desde el frontend (abre un
// enlace wa.me con el listado como texto), ya que Apps Script no puede
// enviar mensajes de WhatsApp sin una cuenta de WhatsApp Business API.
// Esta función solo se encarga del envío real por correo electrónico
// (con MailApp), pudiendo adjuntar el PDF del ticket generado en el navegador.
function enviarFacturaCliente(data) {
  if (!data.correo || !validarEmail_(data.correo)) return {status:'error', message:'Correo electrónico inválido o no proporcionado.'};
  const formato = ['listado','pdf','ambos'].includes(data.formato) ? data.formato : 'listado';
  const cliente = data.cliente_nombre && data.cliente_nombre !== 'N/A' ? data.cliente_nombre : 'Cliente';
  const asunto = `🧾 Tu factura de compra — ${cliente}${data.venta_id ? ' (' + String(data.venta_id).slice(-8) + ')' : ''}`;
  const htmlBody = data.listado_html || `<p>Gracias por tu compra. Adjuntamos el detalle de tu factura.</p>`;
  const opciones = { to: data.correo.trim(), subject: asunto, htmlBody: htmlBody };

  if ((formato === 'pdf' || formato === 'ambos') && data.pdf_base64) {
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(data.pdf_base64), 'application/pdf', data.pdf_filename || 'Factura.pdf');
      opciones.attachments = [blob];
    } catch(e) { /* si el PDF no es válido, se envía solo el listado en el cuerpo */ }
  }

  try {
    MailApp.sendEmail(opciones);
    log(data.usuario, 'Factura - Envío por correo', `${data.correo} · Venta ${data.venta_id||''} · formato: ${formato}`);
    return {status:'success', message:`Factura enviada por correo a ${data.correo}.`};
  } catch(e) {
    return {status:'error', message:'No se pudo enviar el correo: ' + e.message};
  }
}

// Registra en el log de Actividad que se intentó/realizó un envío por
// WhatsApp (la apertura del enlace wa.me ocurre en el navegador del usuario;
// esta llamada es solo para trazabilidad en Reportes de Ventas / Actividad).
function registrarEnvioWhatsapp(data) {
  log(data.usuario, 'Factura - Envío por WhatsApp', `${data.telefono||''} · Venta ${data.venta_id||''} · formato: ${data.formato||'listado'}`);
  return {status:'success', message:'Envío por WhatsApp registrado.'};
}

function formatoMoneda_(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }

// Construye el HTML de un resumen de ventas/compras para un rango de fechas.
function construirHtmlResumen_(titulo, fechaIni, fechaFin) {
  const repVentas = getReporte('ventas', fechaIni.toISOString(), fechaFin.toISOString());
  const repCompras = getReporte('compras', fechaIni.toISOString(), fechaFin.toISOString());
  const totalVentas = repVentas.status === 'success' ? (repVentas.resumen.total || 0) : 0;
  const tickets = repVentas.status === 'success' ? (repVentas.resumen.tickets || 0) : 0;
  const totalCompras = repCompras.status === 'success' ? (repCompras.resumen.total || 0) : 0;

  // Top 5 productos más vendidos en el rango, sumando cantidades de todos los items
  const conteoProductos = {};
  if (repVentas.status === 'success') {
    repVentas.data.forEach(v => (v.items || []).forEach(it => {
      const nombre = it.producto_nombre || 'Producto';
      conteoProductos[nombre] = (conteoProductos[nombre] || 0) + (parseInt(it.cantidad) || 0);
    }));
  }
  const top5 = Object.entries(conteoProductos).sort((a,b) => b[1]-a[1]).slice(0,5);

  let filasTop = top5.map(([nombre, cant]) => `<tr><td style="padding:4px 8px;">${nombre}</td><td style="padding:4px 8px; text-align:right;">${cant}</td></tr>`).join('');
  if (!filasTop) filasTop = '<tr><td colspan="2" style="padding:4px 8px; color:#888;">Sin ventas en este período.</td></tr>';

  return `
    <div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto;">
      <div style="background:#091933; color:#fff; padding:16px 20px; border-radius:8px 8px 0 0;">
        <h2 style="margin:0; font-size:18px;">${titulo}</h2>
        <p style="margin:4px 0 0; font-size:12px; opacity:0.8;">${fechaIni.toLocaleDateString('es-SV')} — ${fechaFin.toLocaleDateString('es-SV')}</p>
      </div>
      <div style="border:1px solid #e5e7eb; border-top:none; padding:20px; border-radius:0 0 8px 8px;">
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <tr><td style="padding:6px 0; color:#6b7280;">Total en ventas</td><td style="padding:6px 0; text-align:right; font-weight:bold; color:#28a745;">${formatoMoneda_(totalVentas)}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Tickets emitidos</td><td style="padding:6px 0; text-align:right; font-weight:bold;">${tickets}</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Total en compras</td><td style="padding:6px 0; text-align:right; font-weight:bold; color:#dc3545;">${formatoMoneda_(totalCompras)}</td></tr>
        </table>
        <h3 style="font-size:14px; margin:0 0 8px;">🔥 Top 5 productos más vendidos</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">${filasTop}</table>
        <p style="margin-top:20px; font-size:11px; color:#9ca3af;">Reporte generado automáticamente por ERP POS LITE.</p>
      </div>
    </div>`;
}

// Etiquetas legibles de cada tipo de reporte, usadas en mensajes de error.
const REPORTES_LABEL_ = {
  mensual: 'Resumen mensual', anual: 'Resumen anual', ventas_grandes: 'Aviso de venta grande',
  stock_bajo: 'Alerta de stock bajo', backup_json: 'Backup JSON', backup_csv: 'Backup CSV'
};

// ── Envío manual de reportes ("Enviar Reporte" en el frontend) ──
// A diferencia del envío automático programado (enviarReportesProgramados,
// más abajo), este envío es a pedido del usuario desde la pantalla de
// Responsables y NO actualiza las columnas de "último envío" — así no
// interfiere con la programación automática, sin importar cuántas veces
// se use. Admite 3 modos (data.modo):
//   'prueba' → envía SOLO los tipos a los que el responsable está
//              suscrito, con datos de EJEMPLO (ficticios), para poder
//              probar sin exponer información real del negocio.
//   'real'   → envía SOLO los tipos a los que el responsable está
//              suscrito, con los datos REALES actuales del sistema.
//   'todo'   → envía los 6 tipos de reporte disponibles (sin importar la
//              suscripción), con datos reales — para probar el sistema
//              completo de punta a punta con esa dirección de correo.
// Además, el frontend deja elegir (con checkboxes) CUÁLES de esos tipos
// enviar en concreto en vez de mandarlos todos de una — para eso puede
// mandar opcionalmente data.tipos (array de tipos). Si se manda, se
// respeta como un filtro sobre lo que el modo ya permite (así alguien no
// puede pedir, por ejemplo, un tipo al que no está suscrito usando el
// modo 'real'). Si no se manda (o llega vacío), se usa el listado
// completo que el modo permite — igual que antes.
function enviarReporteResponsableManual(data) {
  const d = getData(H_RESPONSABLES).data || [];
  const resp = d.find(r => r.id === data.id);
  if (!resp) return {status:'error', message:'Responsable no encontrado.'};

  const modo = ['prueba','real','todo'].includes(data.modo) ? data.modo : 'real';
  const esPrueba = modo === 'prueba';
  const tiposPermitidos = modo === 'todo'
    ? REPORTES_DISPONIBLES.slice()
    : String(resp.reportes || '').split(',').filter(t => REPORTES_DISPONIBLES.includes(t));

  if (!tiposPermitidos.length) {
    return {status:'error', message:'Este responsable no tiene ningún reporte suscrito. Edítalo para elegir al menos uno, o usa "Enviar todo".'};
  }

  const tipos = Array.isArray(data.tipos) && data.tipos.length
    ? tiposPermitidos.filter(t => data.tipos.includes(t))
    : tiposPermitidos;

  if (!tipos.length) {
    return {status:'error', message:'Ninguno de los reportes seleccionados corresponde a este responsable.'};
  }

  let enviados = 0;
  const errores = [];
  tipos.forEach(tipo => {
    try { enviarUnReporteManual_(resp, tipo, esPrueba); enviados++; }
    catch(e) { errores.push(`${REPORTES_LABEL_[tipo] || tipo}: ${e.message}`); }
  });

  log(data.usuario, 'Responsable - Envío manual', `${resp.email} · modo: ${modo} · tipos: ${tipos.join(', ')}`);

  if (enviados && !errores.length) return {status:'success', message:`${enviados} correo(s) enviado(s) a ${resp.email} (modo: ${modo}).`};
  if (enviados && errores.length) return {status:'success', message:`${enviados} correo(s) enviado(s), pero hubo errores en: ${errores.join(' | ')}`};
  return {status:'error', message:'No se pudo enviar ningún correo: ' + errores.join(' | ')};
}

// Envía un único correo de un tipo de reporte para un responsable.
// esPrueba=true usa datos de ejemplo (ficticios); esPrueba=false usa los
// datos reales actuales del sistema. Lanza una excepción si algo falla,
// para que enviarReporteResponsableManual la cuente como error sin
// interrumpir el envío de los demás tipos solicitados.
function enviarUnReporteManual_(resp, tipo, esPrueba) {
  const prefijo = esPrueba ? '🧪 PRUEBA — ' : '';

  if (tipo === 'backup_json' || tipo === 'backup_csv') {
    const esJson = tipo === 'backup_json';
    const adjunto = esPrueba
      ? (esJson ? construirBackupJSONPruebaBlob_() : construirBackupCSVPruebaBlob_())
      : (esJson ? construirBackupJSONBlob_() : construirBackupCSVBlob_());
    const titulo = prefijo + (esJson ? '📅📊 Copia de seguridad (JSON)' : '📅📊 Copia de seguridad (CSV)');
    const html = `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <div style="background:#091933; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">${titulo}</h2></div>
        <div style="padding:18px 20px;">
          <p style="margin:4px 0;">${esPrueba ? 'Este es un envío de PRUEBA con datos ficticios de ejemplo — no corresponde a tu inventario real.' : `Adjunto va la copia de seguridad completa del sistema (${esJson ? 'un solo archivo .json' : 'archivos .csv dentro de un .zip'}), generada el ${new Date().toLocaleString('es-SV')}.`}</p>
          ${esPrueba ? '' : '<p style="margin:12px 0 0; font-size:11px; color:#9ca3af;">Este archivo se puede volver a subir en "Importar / Exportar Datos" para restaurar la información.</p>'}
        </div>
      </div>`;
    enviarCorreoConAdjunto_(resp.email, titulo, html, adjunto);
    return;
  }

  if (tipo === 'mensual' || tipo === 'anual') {
    const hoy = new Date();
    let fi, ff, tituloBase;
    if (tipo === 'anual') {
      fi = new Date(hoy.getFullYear() - 1, 0, 1);
      ff = new Date(hoy.getFullYear() - 1, 11, 31, 23, 59, 59);
      tituloBase = `📊 Reporte Anual ${hoy.getFullYear() - 1}`;
    } else {
      fi = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      ff = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
      tituloBase = `📊 Reporte Mensual — ${fi.toLocaleDateString('es-SV', {month:'long', year:'numeric'})}`;
    }
    const titulo = prefijo + tituloBase;
    const html = esPrueba ? construirHtmlResumenPrueba_(titulo) : construirHtmlResumen_(titulo, fi, ff);
    enviarCorreo_(resp.email, titulo, html);
    return;
  }

  if (tipo === 'ventas_grandes') {
    const titulo = prefijo + '💰 Aviso de venta grande (vista previa)';
    const html = esPrueba ? construirHtmlVentaGrandePrueba_(resp) : construirHtmlVentaGrandeReal_(resp);
    enviarCorreo_(resp.email, titulo, html);
    return;
  }

  if (tipo === 'stock_bajo') {
    const titulo = prefijo + '⚠️ Alerta de stock bajo (vista previa)';
    const html = esPrueba ? construirHtmlStockBajoPrueba_() : construirHtmlStockBajoReal_();
    enviarCorreo_(resp.email, titulo, html);
    return;
  }

  throw new Error('Tipo de reporte no reconocido: ' + tipo);
}

// ── Contenido de EJEMPLO (100% ficticio, nunca datos reales del
// negocio) usado en el modo "prueba" ──
function construirHtmlResumenPrueba_(titulo) {
  return `
    <div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto;">
      <div style="background:#091933; color:#fff; padding:16px 20px; border-radius:8px 8px 0 0;">
        <h2 style="margin:0; font-size:18px;">${titulo}</h2>
        <p style="margin:4px 0 0; font-size:12px; opacity:0.8;">Datos de ejemplo — no corresponden a tu negocio real.</p>
      </div>
      <div style="border:1px solid #e5e7eb; border-top:none; padding:20px; border-radius:0 0 8px 8px;">
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <tr><td style="padding:6px 0; color:#6b7280;">Total en ventas</td><td style="padding:6px 0; text-align:right; font-weight:bold; color:#28a745;">$1,250.00</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Tickets emitidos</td><td style="padding:6px 0; text-align:right; font-weight:bold;">48</td></tr>
          <tr><td style="padding:6px 0; color:#6b7280;">Total en compras</td><td style="padding:6px 0; text-align:right; font-weight:bold; color:#dc3545;">$430.00</td></tr>
        </table>
        <h3 style="font-size:14px; margin:0 0 8px;">🔥 Top 5 productos más vendidos (ejemplo)</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <tr><td style="padding:4px 8px;">Producto de ejemplo A</td><td style="padding:4px 8px; text-align:right;">32</td></tr>
          <tr><td style="padding:4px 8px;">Producto de ejemplo B</td><td style="padding:4px 8px; text-align:right;">21</td></tr>
        </table>
        <p style="margin-top:20px; font-size:11px; color:#9ca3af;">Este es un envío de PRUEBA generado manualmente desde ERP POS LITE.</p>
      </div>
    </div>`;
}

function construirHtmlVentaGrandePrueba_(resp) {
  const umbral = parseFloat(resp.umbral_venta_grande) || 100;
  return `
    <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <div style="background:#28a745; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">💰 Venta grande registrada (ejemplo)</h2></div>
      <div style="padding:18px 20px;">
        <p style="margin:4px 0;">Cliente: <b>Cliente de ejemplo</b></p>
        <p style="margin:4px 0;">Productos: <b>5</b></p>
        <p style="margin:4px 0;">Total: <b style="color:#28a745; font-size:1.2em;">${formatoMoneda_(umbral + 50)}</b></p>
        <p style="margin:12px 0 0; font-size:11px; color:#9ca3af;">Así se vería un aviso cuando una venta real supere tu umbral configurado de ${formatoMoneda_(umbral)}. Este correo es de PRUEBA.</p>
      </div>
    </div>`;
}

// Vista previa REAL: en vez de una venta ficticia (no hay forma de
// "forzar" una venta grande real bajo pedido), se listan las ventas
// reales de los últimos 30 días que sí superaron el umbral configurado.
function construirHtmlVentaGrandeReal_(resp) {
  const umbral = parseFloat(resp.umbral_venta_grande) || 100;
  const ventas = getData(H_VENTAS).data || [];
  const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
  const grandes = ventas
    .filter(v => new Date(v.fecha) >= hace30 && (parseFloat(v.total) || parseFloat(v.subtotal) || 0) > umbral)
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
  const filas = grandes.map(v => `<tr><td style="padding:4px 8px;">${new Date(v.fecha).toLocaleDateString('es-SV')}</td><td style="padding:4px 8px;">${v.cliente_nombre||'N/A'}</td><td style="padding:4px 8px; text-align:right; font-weight:bold;">${formatoMoneda_(v.total||v.subtotal||0)}</td></tr>`).join('');
  return `
    <div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <div style="background:#28a745; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">💰 Ventas que superaron tu umbral (últimos 30 días)</h2></div>
      <div style="padding:18px 20px;">
        <p style="margin:4px 0 12px; font-size:12px; color:#6b7280;">Umbral configurado: ${formatoMoneda_(umbral)}</p>
        ${grandes.length ? `<table style="width:100%; border-collapse:collapse; font-size:13px;"><tr><th style="text-align:left; padding:4px 8px;">Fecha</th><th style="text-align:left; padding:4px 8px;">Cliente</th><th style="text-align:right; padding:4px 8px;">Total</th></tr>${filas}</table>` : '<p style="color:#9ca3af;">No hubo ventas que superaran tu umbral en los últimos 30 días.</p>'}
        <p style="margin-top:14px; font-size:11px; color:#9ca3af;">En el sistema real, este aviso se envía de inmediato apenas se registra una venta que supera tu umbral.</p>
      </div>
    </div>`;
}

function construirHtmlStockBajoPrueba_() {
  return `
    <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <div style="background:#dc3545; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">⚠️ Productos con stock bajo (ejemplo)</h2></div>
      <div style="padding:18px 20px;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <tr><td style="padding:4px 8px;">Producto de ejemplo A</td><td style="padding:4px 8px; text-align:right;">2</td></tr>
          <tr><td style="padding:4px 8px;">Producto de ejemplo B</td><td style="padding:4px 8px; text-align:right;">0</td></tr>
        </table>
        <p style="margin-top:14px; font-size:11px; color:#9ca3af;">Este es un envío de PRUEBA con datos de ejemplo.</p>
      </div>
    </div>`;
}

function construirHtmlStockBajoReal_() {
  const inv = (getData(H_PRODUCTOS).data || []).filter(p => p.activo === true || p.activo === 'true');
  const bajos = inv.filter(p => (parseInt(p.stock) || 0) <= (parseInt(p.stock_minimo) || 5));
  const filas = bajos.map(p => `<tr><td style="padding:4px 8px;">${p.nombre}</td><td style="padding:4px 8px; text-align:right;">${p.stock}</td></tr>`).join('');
  return `
    <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <div style="background:#dc3545; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">⚠️ Productos con stock bajo</h2></div>
      <div style="padding:18px 20px;">
        ${bajos.length ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">${filas}</table>` : '<p style="color:#9ca3af;">Actualmente no hay productos con stock bajo. 🎉</p>'}
        <p style="margin-top:14px; font-size:11px; color:#9ca3af;">Vista previa manual generada desde ERP POS LITE.</p>
      </div>
    </div>`;
}

function construirBackupJSONPruebaBlob_() {
  const backup = {
    generado: new Date().toISOString(), sistema: 'ERP POS LITE (PRUEBA)',
    inventario: [{ nombre:'Producto de ejemplo', codigo:'000000', categoria:'Ejemplo', precio_compra:1, precio_venta:2, stock:10 }],
    filas: [{ nombre:'Producto de ejemplo', codigo:'000000', categoria:'Ejemplo', precio_compra:1, precio_venta:2, stock:10 }],
    ventas: [], categorias: [{ nombre:'Ejemplo' }], papelera: []
  };
  return Utilities.newBlob(JSON.stringify(backup, null, 2), 'application/json', `Backup_PRUEBA_${new Date().toISOString().slice(0,10)}.json`);
}
function construirBackupCSVPruebaBlob_() {
  const fechaTag = new Date().toISOString().slice(0,10);
  const blobs = [Utilities.newBlob(
    filasACSV_(['nombre','codigo','categoria','precio_compra','precio_venta','stock'], [['Producto de ejemplo','000000','Ejemplo',1,2,10]]),
    'text/csv', 'Inventario_PRUEBA.csv'
  )];
  return Utilities.zip(blobs, `Backup_PRUEBA_${fechaTag}.zip`);
}

// Aviso inmediato de venta grande. Se llama desde registrarVenta().
function notificarVentaGrande(ventaId, total, cliente, cantidadItems) {
  const d = getData(H_RESPONSABLES).data || [];
  const suscritos = d.filter(r =>
    (r.activo === true || r.activo === 'true') &&
    String(r.reportes || '').split(',').includes('ventas_grandes') &&
    total > (parseFloat(r.umbral_venta_grande) || 100)
  );
  suscritos.forEach(r => {
    const html = `
      <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <div style="background:#28a745; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">💰 Venta grande registrada</h2></div>
        <div style="padding:18px 20px;">
          <p style="margin:4px 0;">Cliente: <b>${cliente}</b></p>
          <p style="margin:4px 0;">Productos: <b>${cantidadItems}</b></p>
          <p style="margin:4px 0;">Total: <b style="color:#28a745; font-size:1.2em;">${formatoMoneda_(total)}</b></p>
          <p style="margin:12px 0 0; font-size:11px; color:#9ca3af;">Superó tu umbral configurado de ${formatoMoneda_(r.umbral_venta_grande)}.</p>
        </div>
      </div>`;
    try { enviarCorreo_(r.email, `💰 Venta grande: ${formatoMoneda_(total)}`, html); } catch(e) {}
  });
}

// Envío diario de alerta de stock bajo, a quien esté suscrito.
function notificarStockBajo_() {
  const d = getData(H_RESPONSABLES).data || [];
  const suscritos = d.filter(r => (r.activo === true || r.activo === 'true') && String(r.reportes || '').split(',').includes('stock_bajo'));
  if (!suscritos.length) return;
  const inv = (getData(H_PRODUCTOS).data || []).filter(p => (p.activo === true || p.activo === 'true'));
  const bajos = inv.filter(p => (parseInt(p.stock) || 0) <= (parseInt(p.stock_minimo) || 5));
  if (!bajos.length) return;
  const filas = bajos.map(p => `<tr><td style="padding:4px 8px;">${p.nombre}</td><td style="padding:4px 8px; text-align:right;">${p.stock}</td></tr>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
      <div style="background:#dc3545; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">⚠️ Productos con stock bajo</h2></div>
      <div style="padding:18px 20px;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">${filas}</table>
        <p style="margin-top:14px; font-size:11px; color:#9ca3af;">Reporte automático diario de ERP POS LITE.</p>
      </div>
    </div>`;
  const hoyStr = new Date().toDateString();
  const hoja = sh(H_RESPONSABLES);
  suscritos.forEach(r => {
    if (r.ultimo_envio_stock === hoyStr) return; // ya se envió hoy
    try {
      enviarCorreo_(r.email, '⚠️ Alerta de stock bajo', html);
      const {idx} = findRow(hoja, r.id);
      if (idx > -1) hoja.getRange(idx+1, 9).setValue(hoyStr);
    } catch(e) {}
  });
}

// Envío diario de la copia de seguridad (JSON y/o CSV), a quien esté
// suscrito a 'backup_json' y/o 'backup_csv'. Ambos formatos comparten la
// misma marca de "último envío" (columna "ultimo_envio_backup"): si el
// responsable está suscrito a los dos, ambos se mandan en el mismo correo diario.
function enviarBackupsProgramados_() {
  const hoja = sh(H_RESPONSABLES);
  const d = getData(H_RESPONSABLES).data || [];
  const hoyStr = new Date().toDateString();
  const suscritos = d.filter(r => {
    if (!(r.activo === true || r.activo === 'true')) return false;
    const reportes = String(r.reportes || '').split(',');
    return reportes.includes('backup_json') || reportes.includes('backup_csv');
  });
  if (!suscritos.length) return;
  suscritos.forEach(r => {
    if (r.ultimo_envio_backup === hoyStr) return; // ya se envió hoy
    const reportes = String(r.reportes || '').split(',');
    const {idx} = findRow(hoja, r.id);
    if (idx < 0) return;
    try {
      if (reportes.includes('backup_json')) {
        enviarCorreoConAdjunto_(r.email, '📅📊 Copia de seguridad diaria (JSON)',
          '<p style="font-family:Arial,sans-serif;">Adjunto: copia de seguridad completa del sistema en formato JSON.</p>', construirBackupJSONBlob_());
      }
      if (reportes.includes('backup_csv')) {
        enviarCorreoConAdjunto_(r.email, '📅📊 Copia de seguridad diaria (CSV)',
          '<p style="font-family:Arial,sans-serif;">Adjunto: copia de seguridad completa del sistema en archivos CSV, dentro de un .zip.</p>', construirBackupCSVBlob_());
      }
      hoja.getRange(idx+1, 11).setValue(hoyStr); // columna "ultimo_envio_backup"
    } catch(e) {}
  });
}

// ── EJECUCIÓN PROGRAMADA ──
// Esta función está pensada para ejecutarse con un disparador de tiempo
// (Extensiones > Apps Script > Triggers > Añadir disparador > diario).
// Revisa automáticamente qué responsables deben recibir el reporte
// mensual (día 1 de cada mes) y anual (1 de enero), la alerta diaria de
// stock bajo, y la copia de seguridad diaria (JSON/CSV), sin duplicar
// envíos el mismo período.
function enviarReportesProgramados() {
  const hoy = new Date();
  const hoja = sh(H_RESPONSABLES);
  const d = getData(H_RESPONSABLES).data || [];
  let enviados = 0;

  const claveMes = `${hoy.getFullYear()}-${hoy.getMonth()+1}`;
  const esPrimerDiaMes = hoy.getDate() === 1;
  const esPrimerDiaAnio = hoy.getMonth() === 0 && hoy.getDate() === 1;

  d.forEach(r => {
    if (!(r.activo === true || r.activo === 'true')) return;
    const reportes = String(r.reportes || '').split(',');
    const {idx} = findRow(hoja, r.id);
    if (idx < 0) return;

    if (esPrimerDiaMes && reportes.includes('mensual') && r.ultimo_envio_mensual !== claveMes) {
      const fi = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const ff = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
      const titulo = `📊 Reporte Mensual — ${fi.toLocaleDateString('es-SV', {month:'long', year:'numeric'})}`;
      try {
        enviarCorreo_(r.email, titulo, construirHtmlResumen_(titulo, fi, ff));
        hoja.getRange(idx+1, 7).setValue(claveMes);
        enviados++;
      } catch(e) {}
    }
    if (esPrimerDiaAnio && reportes.includes('anual') && String(r.ultimo_envio_anual) !== String(hoy.getFullYear())) {
      const fi = new Date(hoy.getFullYear() - 1, 0, 1);
      const ff = new Date(hoy.getFullYear() - 1, 11, 31, 23, 59, 59);
      const titulo = `📊 Reporte Anual ${hoy.getFullYear() - 1}`;
      try {
        enviarCorreo_(r.email, titulo, construirHtmlResumen_(titulo, fi, ff));
        hoja.getRange(idx+1, 8).setValue(String(hoy.getFullYear()));
        enviados++;
      } catch(e) {}
    }
  });

  try { notificarStockBajo_(); } catch(e) {}
  try { enviarBackupsProgramados_(); } catch(e) {}
  return {status:'success', message:`Ejecución completada. Reportes enviados: ${enviados}.`};
}

// ═══════════════════════════════════════════════════════════════
// ── EMPRESA — configuración general (nombre, dirección, IVA, ticket) ──
// Se guarda en PropertiesService en vez de una hoja aparte porque es un
// solo registro de configuración, no una lista de filas.
// ═══════════════════════════════════════════════════════════════
function getEmpresa() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('empresaConfig');
  const defaults = { nombre:'Mi Negocio', direccion:'', telefono:'', correo:'', iva_pct:0, mensaje_ticket:'¡Gracias por su compra!' };
  let data = defaults;
  if (raw) { try { data = Object.assign({}, defaults, JSON.parse(raw)); } catch(e) {} }
  return { status:'success', data };
}

function guardarEmpresa(data) {
  const props = PropertiesService.getScriptProperties();
  const actual = getEmpresa().data;
  const nuevo = {
    nombre:         data.nombre         !== undefined ? String(data.nombre)         : actual.nombre,
    direccion:      data.direccion      !== undefined ? String(data.direccion)      : actual.direccion,
    telefono:       data.telefono       !== undefined ? String(data.telefono)       : actual.telefono,
    correo:         data.correo         !== undefined ? String(data.correo)         : actual.correo,
    iva_pct:        data.iva_pct        !== undefined ? (parseFloat(data.iva_pct)||0) : actual.iva_pct,
    mensaje_ticket: data.mensaje_ticket !== undefined ? String(data.mensaje_ticket) : actual.mensaje_ticket
  };
  props.setProperty('empresaConfig', JSON.stringify(nuevo));
  log(data.usuario, 'Empresa - Configuración actualizada', nuevo.nombre);
  return { status:'success', message:'Datos de la empresa guardados con éxito.', data: nuevo };
}

// ═══════════════════════════════════════════════════════════════
// ── CLIENTES ──
// ═══════════════════════════════════════════════════════════════
function agregarCliente(data) {
  if (!data.nombre || !String(data.nombre).trim()) return {status:'error', message:'El nombre del cliente es obligatorio.'};
  const id = uid();
  sh(H_CLIENTES).appendRow([id, String(data.nombre).trim(), data.telefono||'', data.correo||'', data.direccion||'', data.nit_dui||'', true, new Date()]);
  log(data.usuario, 'Cliente - Agregar', data.nombre);
  return {status:'success', message:'Cliente agregado con éxito.', data:{id}};
}

function editarCliente(data) {
  const hoja = sh(H_CLIENTES); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Cliente no encontrado.'};
  if (data.nombre)    hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.telefono !== undefined)  hoja.getRange(idx+1, 3).setValue(data.telefono);
  if (data.correo !== undefined)    hoja.getRange(idx+1, 4).setValue(data.correo);
  if (data.direccion !== undefined) hoja.getRange(idx+1, 5).setValue(data.direccion);
  if (data.nit_dui !== undefined)   hoja.getRange(idx+1, 6).setValue(data.nit_dui);
  log(data.usuario, 'Cliente - Editar', data.nombre||data.id);
  return {status:'success', message:'Cliente actualizado con éxito.'};
}

function eliminarCliente(data) {
  const hoja = sh(H_CLIENTES); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Cliente no encontrado.'};
  hoja.getRange(idx+1, 7).setValue(false); // se desactiva, no se borra, para no perder el historial de ventas ligado
  log(data.usuario, 'Cliente - Eliminar', data.id);
  return {status:'success', message:'Cliente eliminado con éxito.'};
}

// ═══════════════════════════════════════════════════════════════
// ── PROVEEDORES ──
// ═══════════════════════════════════════════════════════════════
function agregarProveedor(data) {
  if (!data.nombre || !String(data.nombre).trim()) return {status:'error', message:'El nombre del proveedor es obligatorio.'};
  const id = uid();
  sh(H_PROVEEDORES).appendRow([id, String(data.nombre).trim(), data.telefono||'', data.correo||'', data.direccion||'', data.notas||'', true, new Date()]);
  log(data.usuario, 'Proveedor - Agregar', data.nombre);
  return {status:'success', message:'Proveedor agregado con éxito.', data:{id}};
}

function editarProveedor(data) {
  const hoja = sh(H_PROVEEDORES); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Proveedor no encontrado.'};
  if (data.nombre)    hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.telefono !== undefined)  hoja.getRange(idx+1, 3).setValue(data.telefono);
  if (data.correo !== undefined)    hoja.getRange(idx+1, 4).setValue(data.correo);
  if (data.direccion !== undefined) hoja.getRange(idx+1, 5).setValue(data.direccion);
  if (data.notas !== undefined)     hoja.getRange(idx+1, 6).setValue(data.notas);
  log(data.usuario, 'Proveedor - Editar', data.nombre||data.id);
  return {status:'success', message:'Proveedor actualizado con éxito.'};
}

function eliminarProveedor(data) {
  const hoja = sh(H_PROVEEDORES); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Proveedor no encontrado.'};
  hoja.getRange(idx+1, 7).setValue(false);
  log(data.usuario, 'Proveedor - Eliminar', data.id);
  return {status:'success', message:'Proveedor eliminado con éxito.'};
}

// ═══════════════════════════════════════════════════════════════
// ── USUARIOS (cajeros / administradores adicionales) ──
// Nota de seguridad: al igual que el resto del sistema, esto es control de
// acceso básico ("lite"), no un sistema de autenticación robusto — Apps
// Script no permite hashear/verificar contraseñas de forma segura del lado
// del servidor sin librerías externas. Sirve para llevar un registro de
// quién hizo qué (columna "usuario" en Ventas/Actividad) y para ocultar
// secciones sensibles a cajeros, no para proteger datos críticos.
// ═══════════════════════════════════════════════════════════════
function agregarUsuario(data) {
  if (!data.usuario || !String(data.usuario).trim()) return {status:'error', message:'El nombre de usuario es obligatorio.'};
  if (!data.password) return {status:'error', message:'La contraseña es obligatoria.'};
  const hoja = sh(H_USUARIOS);
  const existentes = (getData(H_USUARIOS).data || []).map(u => String(u.usuario||'').toLowerCase());
  if (existentes.includes(String(data.usuario).trim().toLowerCase()) || String(data.usuario).trim().toLowerCase() === 'admin') {
    return {status:'error', message:'Ese nombre de usuario ya está en uso.'};
  }
  const id = uid();
  hoja.appendRow([id, data.nombre||data.usuario, String(data.usuario).trim(), String(data.password), data.rol||'vendedor', true, new Date()]);
  log(data.usuario_actual, 'Usuario - Agregar', data.usuario);
  return {status:'success', message:'Usuario agregado con éxito.', data:{id}};
}

function editarUsuario(data) {
  const hoja = sh(H_USUARIOS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Usuario no encontrado.'};
  if (data.nombre)   hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.password) hoja.getRange(idx+1, 4).setValue(String(data.password));
  if (data.rol)       hoja.getRange(idx+1, 5).setValue(data.rol);
  log(data.usuario_actual, 'Usuario - Editar', data.nombre||data.id);
  return {status:'success', message:'Usuario actualizado con éxito.'};
}

function toggleUsuario(data) {
  const hoja = sh(H_USUARIOS); const {idx, row} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Usuario no encontrado.'};
  const nuevoEstado = !(row[5] === true || row[5] === 'true');
  hoja.getRange(idx+1, 6).setValue(nuevoEstado);
  log(data.usuario_actual, 'Usuario - Cambiar estado', `${row[2]}: ${nuevoEstado ? 'activado' : 'desactivado'}`);
  return {status:'success', message:`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.`};
}

function eliminarUsuario(data) {
  return eliminarEntidad(H_USUARIOS, data, 'Usuario');
}

function getUsuarios() {
  const d = getData(H_USUARIOS);
  if (d.status !== 'success') return {status:'success', data:[]};
  // Nunca se devuelve la contraseña al frontend.
  const data = d.data.map(u => ({ id:u.id, nombre:u.nombre, usuario:u.usuario, rol:u.rol, activo:u.activo, fecha_creado:u.fecha_creado }));
  return {status:'success', data};
}

// ═══════════════════════════════════════════════════════════════
// ── CAJA (apertura / cierre de turno) ──
// ═══════════════════════════════════════════════════════════════
function getCajaActual() {
  const hoja = sh(H_CAJA);
  if (!hoja || hoja.getLastRow() < 2) return {status:'success', data:null};
  const vals = hoja.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (vals[i][9] === 'abierta') {
      const r = vals[i];
      return {status:'success', data:{ id:r[0], fecha_apertura:r[1], monto_apertura:r[2], usuario_apertura:r[7], estado:r[9], notas:r[10] }};
    }
  }
  return {status:'success', data:null};
}

function abrirCaja(data) {
  const actual = getCajaActual();
  if (actual.data) return {status:'error', message:'Ya hay una caja abierta. Ciérrala antes de abrir una nueva.'};
  const id = uid();
  sh(H_CAJA).appendRow([id, new Date(), parseFloat(data.monto_apertura)||0, '', '', '', '', data.usuario||'Sistema', '', 'abierta', data.notas||'']);
  log(data.usuario, 'Caja - Apertura', `Monto inicial: $${parseFloat(data.monto_apertura)||0}`);
  return {status:'success', message:'Caja abierta con éxito.', data:{id}};
}

function cerrarCaja(data) {
  const hoja = sh(H_CAJA); const {idx, row} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Turno de caja no encontrado.'};
  if (row[9] !== 'abierta') return {status:'warning', message:'Ese turno ya estaba cerrado.'};
  const montoApertura = parseFloat(row[2]) || 0;
  const ventas = (getData(H_VENTAS).data || []).filter(v => String(v.caja_id) === String(data.id) && v.estado !== 'anulada');
  const efectivoVentas = ventas.filter(v => (v.metodo_pago||'Efectivo') === 'Efectivo').reduce((s,v)=>s+(parseFloat(v.total)||0), 0);
  const montoEsperado = Math.round((montoApertura + efectivoVentas) * 100) / 100;
  const montoReal = parseFloat(data.monto_cierre_real) || 0;
  const diferencia = Math.round((montoReal - montoEsperado) * 100) / 100;
  hoja.getRange(idx+1, 4).setValue(new Date());
  hoja.getRange(idx+1, 5).setValue(montoEsperado);
  hoja.getRange(idx+1, 6).setValue(montoReal);
  hoja.getRange(idx+1, 7).setValue(diferencia);
  hoja.getRange(idx+1, 9).setValue(data.usuario||'Sistema');
  hoja.getRange(idx+1, 10).setValue('cerrada');
  log(data.usuario, 'Caja - Cierre', `Esperado: $${montoEsperado} · Real: $${montoReal} · Diferencia: $${diferencia}`);
  return {status:'success', message:'Caja cerrada con éxito.', data:{ monto_esperado:montoEsperado, monto_real:montoReal, diferencia, ventas_efectivo:efectivoVentas, cantidad_ventas: ventas.length }};
}

function getCajaHistorial() {
  const d = getData(H_CAJA);
  if (d.status !== 'success') return {status:'success', data:[]};
  const data = d.data.slice().sort((a,b) => new Date(b.fecha_apertura) - new Date(a.fecha_apertura));
  return {status:'success', data};
}

// ═══════════════════════════════════════════════════════════════
// ── COMBOS (paquetes de productos a precio fijo) ──
// El combo se "vende" expandiéndolo del lado del frontend en sus productos
// componentes dentro del carrito normal (con un descuento para que el
// total cuadre con precio_combo), así que registrarVenta() no necesita
// saber nada de combos — solo hace falta el catálogo aquí.
// ═══════════════════════════════════════════════════════════════
function agregarCombo(data) {
  if (!data.nombre || !Array.isArray(data.items) || !data.items.length) return {status:'error', message:'El combo necesita un nombre y al menos un producto.'};
  const id = uid();
  sh(H_COMBOS).appendRow([id, data.nombre, parseFloat(data.precio_combo)||0, true, new Date()]);
  const shDet = sh(H_COMBO_DET);
  data.items.forEach(it => shDet.appendRow([uid(), id, it.producto_id, parseInt(it.cantidad)||1]));
  log(data.usuario, 'Combo - Agregar', data.nombre);
  return {status:'success', message:'Combo agregado con éxito.', data:{id}};
}

function editarCombo(data) {
  const hoja = sh(H_COMBOS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Combo no encontrado.'};
  if (data.nombre) hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.precio_combo !== undefined) hoja.getRange(idx+1, 3).setValue(parseFloat(data.precio_combo)||0);
  if (Array.isArray(data.items)) {
    const shDet = sh(H_COMBO_DET);
    const vals = shDet.getDataRange().getValues();
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][1]) === String(data.id)) shDet.deleteRow(i+1);
    }
    data.items.forEach(it => shDet.appendRow([uid(), data.id, it.producto_id, parseInt(it.cantidad)||1]));
  }
  log(data.usuario, 'Combo - Editar', data.nombre||data.id);
  return {status:'success', message:'Combo actualizado con éxito.'};
}

function eliminarCombo(data) {
  const hoja = sh(H_COMBOS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Combo no encontrado.'};
  hoja.getRange(idx+1, 4).setValue(false);
  log(data.usuario, 'Combo - Eliminar', data.id);
  return {status:'success', message:'Combo eliminado con éxito.'};
}

function getCombos() {
  const combos = (getData(H_COMBOS).data || []).filter(c => c.activo === true || c.activo === 'true');
  const detalles = getData(H_COMBO_DET).data || [];
  const productos = getData(H_PRODUCTOS).data || [];
  const data = combos.map(c => {
    const items = detalles.filter(d => String(d.combo_id) === String(c.id)).map(d => {
      const p = productos.find(pp => String(pp.id) === String(d.producto_id));
      return { producto_id: d.producto_id, producto_nombre: p ? p.nombre : '(producto eliminado)', cantidad: parseInt(d.cantidad)||1, precio_venta: p ? parseFloat(p.precio_venta)||0 : 0 };
    });
    return { id:c.id, nombre:c.nombre, precio_combo: parseFloat(c.precio_combo)||0, items };
  });
  return {status:'success', data};
}

// ═══════════════════════════════════════════════════════════════
// ── GASTOS ──
// ═══════════════════════════════════════════════════════════════
function agregarGasto(data) {
  if (!data.concepto) return {status:'error', message:'El concepto del gasto es obligatorio.'};
  sh(H_GASTOS).appendRow([uid(), data.fecha ? new Date(data.fecha) : new Date(), data.concepto, parseFloat(data.monto)||0, data.categoria||'General', data.usuario||'Sistema', data.notas||'']);
  log(data.usuario, 'Gasto - Agregar', `${data.concepto}: $${parseFloat(data.monto)||0}`);
  return {status:'success', message:'Gasto registrado con éxito.'};
}

function eliminarGasto(data) { return eliminarEntidad(H_GASTOS, data, 'Gasto'); }

// ═══════════════════════════════════════════════════════════════
// ── DEVOLUCIONES ──
// ═══════════════════════════════════════════════════════════════
function registrarDevolucion(data) {
  const shDet = sh(H_VENTA_DET); const shP = sh(H_PRODUCTOS);
  const detalles = shDet.getDataRange().getValues();
  let linea = null;
  for (let i = 1; i < detalles.length; i++) {
    if (String(detalles[i][1]) === String(data.venta_id) && String(detalles[i][2]) === String(data.producto_id)) { linea = detalles[i]; break; }
  }
  if (!linea) return {status:'error', message:'No se encontró ese producto en la venta indicada.'};
  const cantidadVendida = parseInt(linea[4]) || 0;
  const yaDevuelto = (getData(H_DEVOLUCIONES).data || [])
    .filter(d => String(d.venta_id) === String(data.venta_id) && String(d.producto_id) === String(data.producto_id))
    .reduce((s,d) => s + (parseInt(d.cantidad)||0), 0);
  const cantidad = parseInt(data.cantidad) || 0;
  if (cantidad <= 0) return {status:'error', message:'La cantidad a devolver debe ser mayor a cero.'};
  if (yaDevuelto + cantidad > cantidadVendida) return {status:'error', message:`Solo se pueden devolver hasta ${cantidadVendida - yaDevuelto} unidad(es) más de este producto.`};
  const precioUnitario = parseFloat(linea[5]) || 0;
  const montoDevuelto = Math.round(precioUnitario * cantidad * 100) / 100;
  sh(H_DEVOLUCIONES).appendRow([uid(), data.venta_id, data.producto_id, linea[3], cantidad, data.motivo||'', new Date(), data.usuario||'Sistema', montoDevuelto]);
  const {idx} = findRow(shP, data.producto_id);
  if (idx > -1) shP.getRange(idx+1, 7).setValue((parseInt(shP.getRange(idx+1, 7).getValue())||0) + cantidad);
  log(data.usuario, 'Devolución', `${linea[3]} x${cantidad} · Venta ${data.venta_id} · $${montoDevuelto}`);
  return {status:'success', message:`Devolución registrada. Stock restaurado (+${cantidad}).`, data:{monto_devuelto: montoDevuelto}};
}

// ═══════════════════════════════════════════════════════════════
// ── DASHBOARD — datos agregados para los gráficos ──
// ═══════════════════════════════════════════════════════════════
function getDashboard(fechaIni, fechaFin) {
  const fi = fechaIni ? new Date(fechaIni) : new Date(Date.now() - 13*24*60*60*1000);
  fi.setHours(0,0,0,0);
  const ff = fechaFin ? new Date(fechaFin) : new Date();
  ff.setHours(23,59,59,999);

  const ventas = (getData(H_VENTAS).data || []).filter(v => { const x = new Date(v.fecha); return x >= fi && x <= ff && v.estado !== 'anulada'; });
  const detalles = getData(H_VENTA_DET).data || [];
  const gastos = (getData(H_GASTOS).data || []).filter(g => { const x = new Date(g.fecha); return x >= fi && x <= ff; });

  const porDiaMap = {};
  ventas.forEach(v => {
    const key = new Date(v.fecha).toISOString().slice(0,10);
    porDiaMap[key] = (porDiaMap[key]||0) + (parseFloat(v.total)||0);
  });
  const ventasPorDia = Object.keys(porDiaMap).sort().map(k => ({ fecha:k, total: Math.round(porDiaMap[k]*100)/100 }));

  const idsVentasEnRango = new Set(ventas.map(v => String(v.id)));
  const cantidadPorProducto = {};
  detalles.forEach(d => {
    if (!idsVentasEnRango.has(String(d.venta_id))) return;
    const nombre = d.producto_nombre || d.producto_id;
    cantidadPorProducto[nombre] = (cantidadPorProducto[nombre]||0) + (parseInt(d.cantidad)||0);
  });
  const topProductos = Object.keys(cantidadPorProducto)
    .map(n => ({ producto:n, cantidad:cantidadPorProducto[n] }))
    .sort((a,b) => b.cantidad - a.cantidad).slice(0, 7);

  const totalVentas = ventas.reduce((s,v) => s + (parseFloat(v.total)||0), 0);
  const totalGastos = gastos.reduce((s,g) => s + (parseFloat(g.monto)||0), 0);
  const stockBajo = (getData(H_PRODUCTOS).data || []).filter(p => (p.activo === true || p.activo === 'true') && (parseInt(p.stock)||0) <= (parseInt(p.stock_minimo)||5)).length;

  return {
    status:'success',
    data: {
      ventas_por_dia: ventasPorDia, top_productos: topProductos,
      total_ventas: Math.round(totalVentas*100)/100, total_gastos: Math.round(totalGastos*100)/100,
      ganancia_estimada: Math.round((totalVentas - totalGastos)*100)/100,
      tickets: ventas.length, stock_bajo: stockBajo
    }
  };
}

function resetearBD() {
  const spreadsheet = ss();
  let tempSheet = spreadsheet.insertSheet("TempReset_" + Date.now());
  spreadsheet.getSheets().forEach(s => {
    if (s.getName() !== tempSheet.getName()) spreadsheet.deleteSheet(s);
  });
  iniciarBD();
  spreadsheet.deleteSheet(tempSheet);
  return {status: 'success', message: '¡Formateo completado! Base de datos recreada desde cero.'};
}
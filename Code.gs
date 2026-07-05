// ═══════════════════════════════════════════════════════════════
// ERP POS LITE v4.5 — BACKEND UNIFICADO COMPLETO (Nsg.js)
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = "1mFUnDL6VO5nlktD-dOwOllbbqqIqQWt5OArN2rSy_6I"; 

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

// ── MANTENIMIENTO ── (guardado en PropertiesService, no en hoja)
function getModoMantenimiento() {
  return PropertiesService.getScriptProperties().getProperty('mantenimiento') === 'true';
}
function setModoMantenimiento(valor) {
  PropertiesService.getScriptProperties().setProperty('mantenimiento', valor ? 'true' : 'false');
}

const HDR = {
  Categorias:    ["id","nombre","emoji","activo"],
  Productos:     ["id","nombre","código","categoría","precio_compra","precio_venta","stock","stock_minimo","imagen_url","favorito","activo","fecha_creado"],
  Compras:       ["id","producto_id","cantidad","precio_compra","fecha","usuario","notas"],
  Ventas:        ["id","fecha","cliente_nombre","cliente_whatsapp","cliente_correo","subtotal","descuento","impuesto","total","pago_con","cambio","usuario","estado"],
  VentaDetalle:  ["id","venta_id","producto_id","producto_nombre","cantidad","precio_unitario","descuento_linea","subtotal_linea"],
  Papelera:      ["id","tipo","datos_originales","fecha_eliminado","eliminado_por"],
  Actividad:     ["id","fecha","usuario","accion","detalle"],
  Soporte:       ["id","usuario","titulo","descripcion","estado","fecha","fecha_actualizado","respuesta","admin"],
  HaciendaArchivos: ["id","categoria","nombre_archivo","tipo_archivo","contenido_base64","tamano_bytes","fecha","usuario"],
  Responsables:  ["id","email","nombre","reportes","umbral_venta_grande","activo","ultimo_envio_mensual","ultimo_envio_anual","ultimo_envio_stock","fecha_creado","ultimo_envio_backup"]
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
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).toLowerCase() === String(id).toLowerCase() || String(vals[i][2]).toLowerCase() === String(id).toLowerCase()) return { row: vals[i], idx: i };
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
      case 'activarMantenimiento': setModoMantenimiento(true);  log('Sistema','Mantenimiento','Activado');  r = {status:'success', message:'Mantenimiento activado.'}; break;
      case 'desactivarMantenimiento': setModoMantenimiento(false); log('Sistema','Mantenimiento','Desactivado'); r = {status:'success', message:'Mantenimiento desactivado.'}; break;
      case 'iniciar':   r = iniciarBD(); break;
      case 'resetear':  r = resetearBD(); break;
      case 'getCategorias': r = getData(H_CATEGORIAS); break;
      case 'getInventario': r = {status:'success', data: (getData(H_PRODUCTOS).data || []).filter(x => x.activo === true || x.activo === 'true' || x.activo === 1)}; break;
      case 'getVentas': r = getVentasConDetalle(p.fecha_inicio, p.fecha_fin); break;
      case 'getReporte': r = getReporte(p.tipo, p.fecha_inicio, p.fecha_fin); break;
      case 'getPapelera': r = getData(H_PAPELERA); break;
      case 'getActividad': r = getData(H_ACTIVIDAD); break;
      case 'getSoporte': r = getData(H_SOPORTE); break;
      case 'getArchivosHacienda': r = getArchivosHacienda(p.categoria); break;
      case 'descargarArchivoHacienda': r = descargarArchivoHacienda(p.id); break;
      case 'getResponsables': r = getData(H_RESPONSABLES); break;
      case 'ejecutarEnvioProgramado': r = enviarReportesProgramados(); break;
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
      case 'agregarProducto': sh(H_PRODUCTOS).appendRow([uid(), req.nombre, req.codigo, req.categoria, parseFloat(req.precio_compra)||0, parseFloat(req.precio_venta)||0, parseInt(req.stock)||0, parseInt(req.stock_minimo)||5, req.imagen_url||'', false, true, new Date()]); r = {status:'success', message:'Producto registrado con éxito.'}; break;
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
      default: r = {status:'error', message:'Acción no reconocida'};
    }
    return resp(r);
  } catch(ex) { return resp({status:'error', message:ex.message}); }
}

function login(data) {
  if (String(data.usuario).toLowerCase() === 'admin' && (String(data.password) === 'admin123' || String(data.pin) === 'admin123')) {
    log(data.usuario, 'Login', 'Sesión iniciada');
    return {status:'success', message:'Ingreso exitoso.', data:{id:'1', usuario:'admin', rol:'admin'}};
  }
  return {status:'error', message:'Credenciales de acceso incorrectas.'};
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
  const total = subtotal;
  const ventaId = uid();
  // Cliente y datos de contacto: si no se proporcionan, quedan como 'N/A'.
  // El único dato obligatorio de la venta es el pago (pago_con/cambio).
  const nombreCliente   = data.cliente_nombre   && String(data.cliente_nombre).trim()   !== '' ? String(data.cliente_nombre).trim()   : 'N/A';
  const whatsappCliente = data.cliente_whatsapp && String(data.cliente_whatsapp).trim() !== '' ? String(data.cliente_whatsapp).trim() : 'N/A';
  const correoCliente   = data.cliente_correo   && String(data.cliente_correo).trim()   !== '' ? String(data.cliente_correo).trim()   : 'N/A';

  shV.appendRow([ventaId, new Date(), nombreCliente, whatsappCliente, correoCliente, subtotal, 0, 0, total, data.pago_con||0, data.cambio||0, data.usuario||'Sistema', 'completada']);
  
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
  // correo (listado, PDF o ambos) sin necesidad de volver a consultar el servidor.
  return {
    status:'success', message:'Venta registrada con éxito.',
    data: {
      id: ventaId, fecha: new Date().toISOString(),
      cliente_nombre: nombreCliente, cliente_whatsapp: whatsappCliente, cliente_correo: correoCliente,
      subtotal: subtotal, total: total, pago_con: data.pago_con||0, cambio: data.cambio||0,
      items: data.items.map(it => ({ producto_nombre: it._nombre, cantidad: parseInt(it.cantidad), precio_unitario: parseFloat(it.precio_unitario), subtotal_linea: it._subtotal }))
    }
  };
}

function registrarCompra(data) {
  const shP = sh(H_PRODUCTOS); const {row, idx} = findRow(shP, data.producto_id);
  if (!row) return {status:'error', message:'Producto no encontrado.'};
  const cantidad = parseInt(data.cantidad)||0;
  sh(H_COMPRAS).appendRow([uid(), data.producto_id, cantidad, parseFloat(data.precio_compra)||0, new Date(), data.usuario||'Sistema', data.notas||'']);
  shP.getRange(idx+1,7).setValue((parseInt(shP.getRange(idx+1,7).getValue())||0) + cantidad);
  log(data.usuario, 'Compra', `${row[1]} x${cantidad}`);
  return {status:'success', message:`Compra registrada con éxito. Inventario actualizado.`};
}

function editarProducto(data) {
  const hoja = sh(H_PRODUCTOS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'No encontrado.'};
  if (data.nombre) hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.precio_compra) hoja.getRange(idx+1, 5).setValue(parseFloat(data.precio_compra));
  if (data.precio_venta) hoja.getRange(idx+1, 6).setValue(parseFloat(data.precio_venta));
  if (data.stock !== undefined) hoja.getRange(idx+1, 7).setValue(parseInt(data.stock));
  if (data.categoria) hoja.getRange(idx+1, 4).setValue(data.categoria);
  if (data.codigo) hoja.getRange(idx+1, 3).setValue(data.codigo);
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
    data.filas.forEach(f => {
      try { sh(H_PRODUCTOS).appendRow([uid(), f.nombre, f.codigo||'', f.categoria||'', parseFloat(f.precio_compra)||0, parseFloat(f.precio_venta)||0, parseInt(f.stock)||0, 5, '', false, true, new Date()]); ok++; } catch(e){ err++; }
    });
    resultados.push(`Productos: ${ok} agregados${err ? `, ${err} con error` : ''}`);
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
  [H_CATEGORIAS,H_PRODUCTOS,H_COMPRAS,H_VENTAS,H_VENTA_DET,H_PAPELERA,H_ACTIVIDAD,H_SOPORTE,H_HACIENDA,H_RESPONSABLES].forEach(crearHoja);
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

function enviarReporteResponsableManual(data) {
  const d = getData(H_RESPONSABLES).data || [];
  const resp = d.find(r => r.id === data.id);
  if (!resp) return {status:'error', message:'Responsable no encontrado.'};

  if (data.tipo === 'backup_json' || data.tipo === 'backup_csv') {
    try {
      const esJson = data.tipo === 'backup_json';
      const adjunto = esJson ? construirBackupJSONBlob_() : construirBackupCSVBlob_();
      const titulo = esJson ? '📅📊 Copia de seguridad (JSON)' : '📅📊 Copia de seguridad (CSV)';
      const html = `
        <div style="font-family:Arial,sans-serif; max-width:480px; margin:0 auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
          <div style="background:#091933; color:#fff; padding:14px 20px;"><h2 style="margin:0; font-size:17px;">${titulo}</h2></div>
          <div style="padding:18px 20px;">
            <p style="margin:4px 0;">Adjunto va la copia de seguridad completa del sistema (${esJson ? 'un solo archivo .json' : 'archivos .csv dentro de un .zip'}), generada el ${new Date().toLocaleString('es-SV')}.</p>
            <p style="margin:12px 0 0; font-size:11px; color:#9ca3af;">Este archivo se puede volver a subir en "Importar / Exportar Datos" para restaurar la información.</p>
          </div>
        </div>`;
      enviarCorreoConAdjunto_(resp.email, titulo, html, adjunto);
      log(data.usuario, 'Responsable - Envío manual', `${resp.email} (${data.tipo})`);
      return {status:'success', message:`Copia de seguridad enviada a ${resp.email}.`};
    } catch(e) {
      return {status:'error', message:'No se pudo enviar la copia de seguridad: ' + e.message};
    }
  }

  const hoy = new Date();
  let fi, ff, titulo;
  if (data.tipo === 'anual') {
    fi = new Date(hoy.getFullYear() - 1, 0, 1);
    ff = new Date(hoy.getFullYear() - 1, 11, 31, 23, 59, 59);
    titulo = `📊 Reporte Anual ${hoy.getFullYear() - 1}`;
  } else {
    fi = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    ff = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59);
    titulo = `📊 Reporte Mensual — ${fi.toLocaleDateString('es-SV', {month:'long', year:'numeric'})}`;
  }
  try {
    enviarCorreo_(resp.email, titulo, construirHtmlResumen_(titulo, fi, ff));
    log(data.usuario, 'Responsable - Envío manual', `${resp.email} (${data.tipo})`);
    return {status:'success', message:`Reporte enviado a ${resp.email}.`};
  } catch(e) {
    return {status:'error', message:'No se pudo enviar el correo: ' + e.message};
  }
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

/* =========================================================================
   STOCKFERRE — Sistema de inventario para ferretería (100% frontend)
   Persistencia: LocalStorage
   Preparado para futura sincronización con API / n8n / WhatsApp / Telegram
   ========================================================================= */

const STORAGE_KEY = 'stockferre_db_v1';
const API_URL_KEY = 'stockferre_api_url';

let db = null;

/* -------------------------------------------------------------------------
   1. MODELO DE DATOS + PERSISTENCIA LOCAL
   ------------------------------------------------------------------------- */

function defaultDB(){
  return {
    productos: [],
    entradas: [],
    salidas: [],
    gastos: [],
    config: { stockMinimoGlobal: 5, moneda: 'Bs' },
    contador: { producto: 1000, entrada: 1, salida: 1, gasto: 1 }
  };
}

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      db = JSON.parse(raw);
      // Backfill de campos por si el backup es de una versión anterior
      db.config = db.config || { stockMinimoGlobal: 5, moneda: 'Bs' };
      db.contador = db.contador || { producto: 1000, entrada: 1, salida: 1, gasto: 1 };
      db.gastos = db.gastos || [];
      return;
    }
  }catch(e){ console.error('Error leyendo LocalStorage', e); }
  db = defaultDB();
  seedSampleData();
  saveDB();
}

function saveDB(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }catch(e){
    console.error('Error guardando en LocalStorage', e);
    toast('No se pudo guardar en el almacenamiento local (¿espacio lleno?)', 'error');
  }
}

/* -------------------------------------------------------------------------
   2. FUNCIONES PREPARADAS PARA API (comentadas / stub)
   Cuando exista una API real, se puede activar la sincronización aquí.
   Pensado para conectarse con n8n como intermediario hacia WhatsApp/Telegram.
   ------------------------------------------------------------------------- */

function getApiUrl(){
  return localStorage.getItem(API_URL_KEY) || '';
}
function setApiUrl(url){
  localStorage.setItem(API_URL_KEY, url || '');
}

async function apiSyncProducto(producto){
  const apiUrl = getApiUrl();
  if(!apiUrl) return; // sin API configurada, no hace nada
  /*
  try{
    await fetch(apiUrl + '/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(producto)
    });
  }catch(e){ console.warn('No se pudo sincronizar con la API', e); }
  */
}
async function apiSyncEntrada(entrada){ /* misma idea que apiSyncProducto -> POST /entradas */ }
async function apiSyncSalida(salida){ /* misma idea que apiSyncProducto -> POST /salidas */ }
async function apiNotifyStockBajo(producto){
  // En el futuro: POST a un webhook de n8n que reenvíe una alerta a Telegram/WhatsApp
  const apiUrl = getApiUrl();
  if(!apiUrl) return;
  /*
  try{
    await fetch(apiUrl + '/webhooks/stock-bajo', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ codigo: producto.codigo, nombre: producto.nombre, stock: computeStock(producto.codigo) })
    });
  }catch(e){ console.warn(e); }
  */
}

/* -------------------------------------------------------------------------
   3. UTILIDADES GENERALES
   ------------------------------------------------------------------------- */

function uid(tipo){
  const id = db.contador[tipo]++;
  return id;
}

function todayISO(){
  return new Date().toISOString();
}

function toDateInputValue(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toISOString().slice(0,10);
}

function fmtMoney(n){
  const v = Number(n||0);
  return `${db.config.moneda} ${v.toFixed(2)}`;
}

function fmtDate(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '-';
  return d.toLocaleDateString('es-BO', {day:'2-digit', month:'2-digit', year:'numeric'}) +
    ' ' + d.toLocaleTimeString('es-BO', {hour:'2-digit', minute:'2-digit'});
}

function fmtDateShort(iso){
  const d = new Date(iso);
  if(isNaN(d)) return '-';
  return d.toLocaleDateString('es-BO', {day:'2-digit', month:'2-digit', year:'numeric'});
}

function escapeHtml(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function toast(msg, type='info'){
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(()=>{ el.remove(); }, 3200);
}

function openModal(id){
  document.getElementById(id).classList.add('open');
  document.getElementById('modalBackdrop').classList.add('open');
}
function closeAllModals(){
  document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));
  document.getElementById('modalBackdrop').classList.remove('open');
  stopScanner();
}

let confirmCallback = null;
function askConfirm(title, message, onAccept){
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = onAccept;
  openModal('modalConfirm');
}

/* -------------------------------------------------------------------------
   4. LÓGICA DE NEGOCIO: PRODUCTOS / STOCK / GANANCIAS
   ------------------------------------------------------------------------- */

function getProducto(codigo){
  return db.productos.find(p => p.codigo.toLowerCase() === String(codigo).toLowerCase());
}
function getProductoById(id){
  return db.productos.find(p => p.id === Number(id));
}

function computeStock(codigo){
  const entradasSum = db.entradas
    .filter(e => e.codigo.toLowerCase() === String(codigo).toLowerCase())
    .reduce((s,e)=> s + Number(e.cantidad), 0);
  const salidasSum = db.salidas
    .filter(s => s.codigo.toLowerCase() === String(codigo).toLowerCase())
    .reduce((s,x)=> s + Number(x.cantidad), 0);
  return entradasSum - salidasSum;
}

function computeGanancia(precioVenta, precioCompra, cantidad){
  return (Number(precioVenta) - Number(precioCompra)) * Number(cantidad);
}

function isStockBajo(producto){
  const stock = computeStock(producto.codigo);
  const minimo = producto.stockMinimo ?? db.config.stockMinimoGlobal;
  return stock < minimo;
}

function categoriasUnicas(){
  return [...new Set(db.productos.map(p=>p.categoria).filter(Boolean))].sort();
}
function marcasUnicas(){
  return [...new Set(db.productos.map(p=>p.marca).filter(Boolean))].sort();
}

/* -------------------------------------------------------------------------
   5. DATOS DE EJEMPLO (50 PRODUCTOS)
   ------------------------------------------------------------------------- */

function seedSampleData(){
  const categorias = [
    {cat:'Alicates', marcas:['INGCO','STANLEY','TRUPER']},
    {cat:'Martillos', marcas:['STANLEY','TRUPER','BLACK+DECKER']},
    {cat:'Destornilladores', marcas:['INGCO','TRUPER','BOSCH']},
    {cat:'Taladros', marcas:['BOSCH','BLACK+DECKER','DEWALT']},
    {cat:'Llaves', marcas:['STANLEY','TRUPER','INGCO']},
    {cat:'Cintas métricas', marcas:['STANLEY','TRUPER']},
    {cat:'Tornillos y anclajes', marcas:['GENERICO','TRUPER']},
    {cat:'Pintura y brochas', marcas:['SUPERMEZCLA','TRUPER','COLORAMA']},
    {cat:'Seguridad industrial', marcas:['3M','INGCO','TRUPER']},
    {cat:'Electricidad', marcas:['SUPERCABLE','BTICINO','GENERICO']}
  ];
  const nombresPorCategoria = {
    'Alicates': ['ALICATE A PRESION 10" MORDAZA CURVA','ALICATE DE CORTE 6"','ALICATE PUNTA FINA 8"','ALICATE UNIVERSAL 7"','ALICATE PELACABLES'],
    'Martillos': ['MARTILLO CARPINTERO 16OZ','MARTILLO DE GOMA 24OZ','MARTILLO DEMOLEDOR 3LB','MAZO DE HULE 32OZ','MARTILLO PENA 8OZ'],
    'Destornilladores': ['DESTORNILLADOR PLANO 6"','DESTORNILLADOR ESTRELLA 8"','JUEGO DESTORNILLADORES 6PZ','DESTORNILLADOR DE PRECISION','DESTORNILLADOR ANTICHISPA'],
    'Taladros': ['TALADRO PERCUTOR 750W','TALADRO INALAMBRICO 20V','ROTOMARTILLO SDS PLUS','TALADRO DE BANCO','ATORNILLADOR INALAMBRICO'],
    'Llaves': ['JUEGO LLAVES MIXTAS 8-19MM','LLAVE AJUSTABLE 10"','LLAVE STILSON 14"','JUEGO LLAVES ALLEN','LLAVE DE TUBO 12"'],
    'Cintas métricas': ['CINTA METRICA 5M','CINTA METRICA 8M','FLEXOMETRO 3M','CINTA METRICA 30M FIBRA','NIVEL DE BURBUJA 60CM'],
    'Tornillos y anclajes': ['TORNILLO AUTOPERFORANTE 1" (CAJA)','TARUGO PLASTICO N°8 (BOLSA)','TORNILLO DRYWALL 1.5" (CAJA)','PERNO HEXAGONAL 3/8 (BOLSA)','CLAVO ACERO 2" (KG)'],
    'Pintura y brochas': ['BROCHA 3"','RODILLO DE ESPUMA 9"','PINTURA LATEX BLANCO 1GAL','BANDEJA PARA RODILLO','MASILLA PARA MADERA'],
    'Seguridad industrial': ['GUANTES DE CUERO','LENTES DE SEGURIDAD','CASCO DE SEGURIDAD','MASCARILLA N95 (CAJA)','ARNES DE SEGURIDAD'],
    'Electricidad': ['CABLE THHN N°12 (ROLLO)','TOMACORRIENTE DOBLE','INTERRUPTOR SIMPLE','CINTA AISLANTE','FOCO LED 9W']
  };

  let codigoIdx = 1;
  categorias.forEach(({cat, marcas})=>{
    const nombres = nombresPorCategoria[cat];
    nombres.forEach((nombre, i)=>{
      const marca = marcas[i % marcas.length];
      const precioCompra = Math.round((10 + Math.random()*90) * 100)/100;
      const margen = 1.4 + Math.random()*0.9;
      const precioVenta = Math.round(precioCompra * margen * 100)/100;
      const id = uid('producto');
      const codigo = 'FE' + String(codigoIdx).padStart(5,'0');
      codigoIdx++;
      const stockInicial = Math.floor(Math.random()*30) + 2;
      const stockMinimo = [3,5,5,8,10][Math.floor(Math.random()*5)];

      db.productos.push({
        id, codigo, nombre, marca, categoria: cat,
        importadora: marca + ' BOLIVIA',
        precioCompra, precioVenta, stockMinimo,
        activo: true,
        fechaCreacion: todayISO()
      });

      db.entradas.push({
        id: uid('entrada'), codigo, precioCompra,
        importadora: marca + ' BOLIVIA', cantidad: stockInicial,
        fecha: todayISO(), usuario: 'admin', observacion: 'Stock inicial de ejemplo'
      });

      // Algunas ventas de ejemplo aleatorias en productos variados
      if(Math.random() > 0.5 && stockInicial > 3){
        const cantVenta = Math.floor(Math.random()* Math.min(4, stockInicial-1)) + 1;
        const fechaVenta = new Date();
        fechaVenta.setDate(fechaVenta.getDate() - Math.floor(Math.random()*7));
        db.salidas.push({
          id: uid('salida'), codigo, precioVenta,
          cantidad: cantVenta, fecha: fechaVenta.toISOString(),
          usuario: 'admin', cliente: '', observacion: ''
        });
      }
    });
  });
}

/* -------------------------------------------------------------------------
   6. NAVEGACIÓN ENTRE VISTAS
   ------------------------------------------------------------------------- */

const viewTitles = {
  dashboard:'Inicio', productos:'Productos', compras:'Compras', ventas:'Ventas',
  pedidos:'Pedidos', caja:'Caja diaria', reportes:'Reportes', gastos:'Gastos', config:'Configuración'
};

function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-view="${name}"]`);
  if(navBtn) navBtn.classList.add('active');
  document.getElementById('viewTitle').textContent = viewTitles[name] || '';
  closeSidebarMobile();

  if(name === 'dashboard') renderDashboard();
  if(name === 'productos') renderProductos();
  if(name === 'compras') renderCompras();
  if(name === 'ventas') renderVentas();
  if(name === 'pedidos') renderPedidos();
  if(name === 'caja') renderCaja();
  if(name === 'reportes') renderReportesInit();
  if(name === 'gastos') renderGastos();
  if(name === 'config') renderConfig();
}

function closeSidebarMobile(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* -------------------------------------------------------------------------
   7. DASHBOARD
   ------------------------------------------------------------------------- */

function renderDashboard(){
  const activos = db.productos.filter(p=>p.activo);
  const stockTotal = activos.reduce((s,p)=> s + computeStock(p.codigo), 0);

  const hoy = new Date().toDateString();
  const ventasHoy = db.salidas.filter(s => new Date(s.fecha).toDateString() === hoy);
  const totalVentasHoy = ventasHoy.reduce((s,v)=> s + v.precioVenta*v.cantidad, 0);

  const gananciaTotal = db.salidas.reduce((s,v)=>{
    const p = getProducto(v.codigo);
    const pc = p ? p.precioCompra : 0;
    return s + computeGanancia(v.precioVenta, pc, v.cantidad);
  }, 0);

  const cards = [
    {label:'Productos activos', value: activos.length, cls:''},
    {label:'Stock total (unidades)', value: stockTotal, cls:'success'},
    {label:'Ventas de hoy', value: fmtMoney(totalVentasHoy), cls:''},
    {label:'Ganancia acumulada', value: fmtMoney(gananciaTotal), cls:'success'},
  ];
  document.getElementById('dashCards').innerHTML = cards.map(c=>`
    <div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
    </div>
  `).join('');

  // Top 5 productos más vendidos
  const ventasPorProducto = {};
  db.salidas.forEach(v=>{
    if(!ventasPorProducto[v.codigo]) ventasPorProducto[v.codigo] = {cantidad:0, ingresos:0};
    ventasPorProducto[v.codigo].cantidad += Number(v.cantidad);
    ventasPorProducto[v.codigo].ingresos += Number(v.cantidad)*Number(v.precioVenta);
  });
  const top5 = Object.entries(ventasPorProducto)
    .sort((a,b)=> b[1].cantidad - a[1].cantidad)
    .slice(0,5);
  const topTbody = document.querySelector('#topProductsTable tbody');
  if(top5.length === 0){
    topTbody.innerHTML = `<tr class="empty-row"><td colspan="3">Todavía no hay ventas registradas</td></tr>`;
  }else{
    topTbody.innerHTML = top5.map(([codigo, d])=>{
      const p = getProducto(codigo);
      return `<tr><td>${escapeHtml(p ? p.nombre : codigo)}</td><td>${d.cantidad}</td><td>${fmtMoney(d.ingresos)}</td></tr>`;
    }).join('');
  }

  // Stock bajo
  const bajos = activos.filter(isStockBajo);
  const lowTbody = document.querySelector('#lowStockTable tbody');
  if(bajos.length === 0){
    lowTbody.innerHTML = `<tr class="empty-row"><td colspan="4">No hay productos con stock bajo 🎉</td></tr>`;
  }else{
    lowTbody.innerHTML = bajos.slice(0,8).map(p=>`
      <tr class="row-low-stock">
        <td>${escapeHtml(p.codigo)}</td><td>${escapeHtml(p.nombre)}</td>
        <td>${computeStock(p.codigo)}</td><td>${p.stockMinimo ?? db.config.stockMinimoGlobal}</td>
      </tr>`).join('');
  }

  // Gráfico últimos 7 días
  const dias = [];
  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    dias.push(d);
  }
  const totales = dias.map(d=>{
    const key = d.toDateString();
    return db.salidas.filter(s=> new Date(s.fecha).toDateString() === key)
      .reduce((sum,s)=> sum + s.cantidad*s.precioVenta, 0);
  });
  const max = Math.max(...totales, 1);
  document.getElementById('weekChart').innerHTML = dias.map((d,i)=>`
    <div class="bar-col">
      <div class="bar-value">${totales[i] > 0 ? fmtMoney(totales[i]) : ''}</div>
      <div class="bar" style="height:${Math.max(4,(totales[i]/max)*140)}px"></div>
      <div class="bar-label">${d.toLocaleDateString('es-BO',{weekday:'short'})}</div>
    </div>
  `).join('');
}

/* -------------------------------------------------------------------------
   8. PRODUCTOS (CRUD + búsqueda/filtros)
   ------------------------------------------------------------------------- */

function refreshProductFilters(){
  const catSel = document.getElementById('prodFilterCategoria');
  const marcaSel = document.getElementById('prodFilterMarca');
  const curCat = catSel.value, curMarca = marcaSel.value;
  catSel.innerHTML = '<option value="">Todas las categorías</option>' +
    categoriasUnicas().map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  marcaSel.innerHTML = '<option value="">Todas las marcas</option>' +
    marcasUnicas().map(m=>`<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  catSel.value = curCat; marcaSel.value = curMarca;

  document.getElementById('categoriasList').innerHTML =
    categoriasUnicas().map(c=>`<option value="${escapeHtml(c)}">`).join('');
}

function renderProductos(){
  refreshProductFilters();
  const search = document.getElementById('prodSearch').value.trim().toLowerCase();
  const fCat = document.getElementById('prodFilterCategoria').value;
  const fMarca = document.getElementById('prodFilterMarca').value;

  let list = db.productos.slice();
  if(search){
    list = list.filter(p =>
      p.codigo.toLowerCase().includes(search) ||
      p.nombre.toLowerCase().includes(search) ||
      (p.marca||'').toLowerCase().includes(search)
    );
  }
  if(fCat) list = list.filter(p=>p.categoria === fCat);
  if(fMarca) list = list.filter(p=>p.marca === fMarca);

  list.sort((a,b)=> a.nombre.localeCompare(b.nombre));

  const tbody = document.querySelector('#productsTable tbody');
  if(list.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">No se encontraron productos</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p=>{
    const stock = computeStock(p.codigo);
    const bajo = isStockBajo(p);
    return `
    <tr class="${bajo ? 'row-low-stock' : ''}">
      <td>${escapeHtml(p.codigo)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${escapeHtml(p.marca||'-')}</td>
      <td>${escapeHtml(p.categoria||'-')}</td>
      <td>${stock}</td>
      <td>${p.stockMinimo ?? db.config.stockMinimoGlobal}</td>
      <td>${fmtMoney(p.precioCompra)}</td>
      <td>${fmtMoney(p.precioVenta)}</td>
      <td>${p.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-muted">Inactivo</span>'}</td>
      <td>
        <button class="btn-icon" title="Editar" data-edit-product="${p.id}">✏️</button>
        <button class="btn-icon" title="${p.activo ? 'Desactivar' : 'Activar'}" data-toggle-product="${p.id}">${p.activo ? '🚫' : '✅'}</button>
      </td>
    </tr>`;
  }).join('');
}

function openProductModal(producto=null, codigoPrefill=''){
  document.getElementById('formProducto').reset();
  document.getElementById('modalProductoTitle').textContent = producto ? 'Editar producto' : 'Nuevo producto';
  document.getElementById('pId').value = producto ? producto.id : '';
  document.getElementById('pCodigo').value = producto ? producto.codigo : codigoPrefill;
  document.getElementById('pCodigo').disabled = !!producto;
  document.getElementById('pNombre').value = producto ? producto.nombre : '';
  document.getElementById('pMarca').value = producto ? producto.marca||'' : '';
  document.getElementById('pCategoria').value = producto ? producto.categoria||'' : '';
  document.getElementById('pImportadora').value = producto ? producto.importadora||'' : '';
  document.getElementById('pPrecioCompra').value = producto ? producto.precioCompra : '';
  document.getElementById('pPrecioVenta').value = producto ? producto.precioVenta : '';
  document.getElementById('pStock').value = producto ? computeStock(producto.codigo) : 0;
  document.getElementById('pStockMinimo').value = producto ? (producto.stockMinimo ?? db.config.stockMinimoGlobal) : db.config.stockMinimoGlobal;
  document.getElementById('pActivo').value = producto ? String(producto.activo) : 'true';
  refreshProductFilters();
  openModal('modalProducto');
}

function handleProductSubmit(e){
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const codigo = document.getElementById('pCodigo').value.trim();
  const nombre = document.getElementById('pNombre').value.trim();
  const marca = document.getElementById('pMarca').value.trim();
  const categoria = document.getElementById('pCategoria').value.trim();
  const importadora = document.getElementById('pImportadora').value.trim();
  const precioCompra = parseFloat(document.getElementById('pPrecioCompra').value) || 0;
  const precioVenta = parseFloat(document.getElementById('pPrecioVenta').value) || 0;
  const nuevoStock = parseInt(document.getElementById('pStock').value, 10) || 0;
  const stockMinimo = parseInt(document.getElementById('pStockMinimo').value, 10) || 0;
  const activo = document.getElementById('pActivo').value === 'true';

  if(!codigo || !nombre){ toast('Código y nombre son obligatorios', 'error'); return; }

  if(id){
    // Editar producto existente
    const p = getProductoById(id);
    if(!p){ toast('Producto no encontrado', 'error'); return; }
    const stockAnterior = computeStock(p.codigo);

    p.nombre = nombre; p.marca = marca; p.categoria = categoria;
    p.importadora = importadora; p.precioCompra = precioCompra; p.precioVenta = precioVenta;
    p.stockMinimo = stockMinimo; p.activo = activo;

    // Auditoría: si el stock cambió manualmente, se registra como entrada/salida
    const diff = nuevoStock - stockAnterior;
    if(diff > 0){
      db.entradas.push({ id: uid('entrada'), codigo:p.codigo, precioCompra, importadora,
        cantidad: diff, fecha: todayISO(), usuario:'admin', observacion:'Ajuste manual' });
    }else if(diff < 0){
      db.salidas.push({ id: uid('salida'), codigo:p.codigo, precioVenta,
        cantidad: Math.abs(diff), fecha: todayISO(), usuario:'admin', cliente:'', observacion:'Ajuste manual' });
    }
    saveDB();
    toast('Producto actualizado', 'success');
    apiSyncProducto(p);
  }else{
    // Nuevo producto — validar código duplicado
    if(getProducto(codigo)){ toast('Ya existe un producto con ese código', 'error'); return; }
    const nuevo = {
      id: uid('producto'), codigo, nombre, marca, categoria, importadora,
      precioCompra, precioVenta, stockMinimo, activo, fechaCreacion: todayISO()
    };
    db.productos.push(nuevo);
    if(nuevoStock > 0){
      db.entradas.push({ id: uid('entrada'), codigo, precioCompra, importadora,
        cantidad: nuevoStock, fecha: todayISO(), usuario:'admin', observacion:'Stock inicial' });
    }
    saveDB();
    toast('Producto creado', 'success');
    apiSyncProducto(nuevo);
  }
  closeAllModals();
  renderProductos();
}

function toggleProductoActivo(id){
  const p = getProductoById(id);
  if(!p) return;
  p.activo = !p.activo;
  saveDB();
  toast(p.activo ? 'Producto activado' : 'Producto desactivado (soft delete)', 'success');
  renderProductos();
}

/* -------------------------------------------------------------------------
   9. COMPRAS (ENTRADAS)
   ------------------------------------------------------------------------- */

function renderCompras(){
  const desde = document.getElementById('compraFechaDesde').value;
  const hasta = document.getElementById('compraFechaHasta').value;
  const filtro = document.getElementById('compraProductoFiltro').value.trim().toLowerCase();

  let list = db.entradas.slice();
  if(desde) list = list.filter(e => e.fecha.slice(0,10) >= desde);
  if(hasta) list = list.filter(e => e.fecha.slice(0,10) <= hasta);
  if(filtro){
    list = list.filter(e=>{
      const p = getProducto(e.codigo);
      return e.codigo.toLowerCase().includes(filtro) || (p && p.nombre.toLowerCase().includes(filtro));
    });
  }
  list.sort((a,b)=> new Date(b.fecha) - new Date(a.fecha));

  const tbody = document.querySelector('#comprasTable tbody');
  if(list.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No hay compras registradas en este período</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(e=>{
    const p = getProducto(e.codigo);
    return `<tr>
      <td>${fmtDate(e.fecha)}</td><td>${escapeHtml(e.codigo)}</td><td>${escapeHtml(p?p.nombre:'(producto eliminado)')}</td>
      <td>${e.cantidad}</td><td>${fmtMoney(e.precioCompra)}</td><td>${escapeHtml(e.importadora||'-')}</td>
      <td>${fmtMoney(e.cantidad*e.precioCompra)}</td>
      <td><button class="btn-icon" title="Eliminar" data-delete-entrada="${e.id}">🗑️</button></td>
    </tr>`;
  }).join('');
}

function openEntradaModal(codigoPrefill=''){
  document.getElementById('formEntrada').reset();
  document.getElementById('eCodigo').value = codigoPrefill;
  document.getElementById('eFecha').value = toDateInputValue(new Date());
  updateEntradaProductInfo();
  openModal('modalEntrada');
}

function updateEntradaProductInfo(){
  const codigo = document.getElementById('eCodigo').value.trim();
  const box = document.getElementById('eProductInfo');
  const p = codigo ? getProducto(codigo) : null;
  if(!codigo){ box.className = 'product-info-box'; box.innerHTML=''; return; }
  if(p){
    box.className = 'product-info-box visible';
    box.innerHTML = `📦 <strong>${escapeHtml(p.nombre)}</strong> — Stock actual: ${computeStock(p.codigo)} · Últ. precio compra: ${fmtMoney(p.precioCompra)}`;
    document.getElementById('ePrecioCompra').value = p.precioCompra;
    document.getElementById('eImportadora').value = p.importadora || '';
  }else{
    box.className = 'product-info-box new visible';
    box.innerHTML = `⚠️ No existe un producto con este código. Se creará uno nuevo al registrar la entrada (podrás completar el nombre luego en Productos).`;
  }
}

function handleEntradaSubmit(e){
  e.preventDefault();
  const codigo = document.getElementById('eCodigo').value.trim();
  const cantidad = parseInt(document.getElementById('eCantidad').value,10);
  const precioCompra = parseFloat(document.getElementById('ePrecioCompra').value);
  const importadora = document.getElementById('eImportadora').value.trim();
  const fecha = document.getElementById('eFecha').value ? new Date(document.getElementById('eFecha').value).toISOString() : todayISO();
  const observacion = document.getElementById('eObservacion').value.trim();

  if(!codigo || !cantidad || cantidad <= 0 || isNaN(precioCompra) || precioCompra < 0){
    toast('Completa código, cantidad y precio de compra correctamente', 'error'); return;
  }

  let p = getProducto(codigo);
  if(!p){
    p = {
      id: uid('producto'), codigo, nombre: `Producto ${codigo} (completar nombre)`,
      marca:'', categoria:'', importadora, precioCompra, precioVenta: precioCompra*1.3,
      stockMinimo: db.config.stockMinimoGlobal, activo:true, fechaCreacion: todayISO()
    };
    db.productos.push(p);
    toast('Se creó un producto nuevo con este código. Complétalo en Productos.', 'warning');
  }else{
    p.precioCompra = precioCompra; // el precio de compra se actualiza con la última entrada
    if(importadora) p.importadora = importadora;
  }

  const entrada = { id: uid('entrada'), codigo, precioCompra, importadora, cantidad, fecha, usuario:'admin', observacion };
  db.entradas.push(entrada);
  saveDB();
  apiSyncEntrada(entrada);
  toast('Entrada registrada correctamente', 'success');
  closeAllModals();
  renderCompras();
}

function deleteEntrada(id){
  askConfirm('Eliminar entrada', '¿Seguro que deseas eliminar este registro de compra? El stock se recalculará automáticamente.', ()=>{
    db.entradas = db.entradas.filter(e=>e.id !== Number(id));
    saveDB();
    closeAllModals();
    renderCompras();
    toast('Entrada eliminada', 'success');
  });
}

/* -------------------------------------------------------------------------
   10. VENTAS (SALIDAS)
   ------------------------------------------------------------------------- */

function renderVentas(){
  const desde = document.getElementById('ventaFechaDesde').value;
  const hasta = document.getElementById('ventaFechaHasta').value;
  const filtro = document.getElementById('ventaProductoFiltro').value.trim().toLowerCase();

  let list = db.salidas.slice();
  if(desde) list = list.filter(s => s.fecha.slice(0,10) >= desde);
  if(hasta) list = list.filter(s => s.fecha.slice(0,10) <= hasta);
  if(filtro){
    list = list.filter(s=>{
      const p = getProducto(s.codigo);
      return s.codigo.toLowerCase().includes(filtro) || (p && p.nombre.toLowerCase().includes(filtro));
    });
  }
  list.sort((a,b)=> new Date(b.fecha) - new Date(a.fecha));

  const tbody = document.querySelector('#ventasTable tbody');
  if(list.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No hay ventas registradas en este período</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s=>{
    const p = getProducto(s.codigo);
    const ganancia = computeGanancia(s.precioVenta, p ? p.precioCompra : 0, s.cantidad);
    return `<tr>
      <td>${fmtDate(s.fecha)}</td><td>${escapeHtml(s.codigo)}</td><td>${escapeHtml(p?p.nombre:'(producto eliminado)')}</td>
      <td>${s.cantidad}</td><td>${fmtMoney(s.precioVenta)}</td><td>${escapeHtml(s.cliente||'-')}</td>
      <td class="${ganancia>=0?'money-pos':'money-neg'}">${fmtMoney(ganancia)}</td>
      <td><button class="btn-icon" title="Eliminar" data-delete-salida="${s.id}">🗑️</button></td>
    </tr>`;
  }).join('');
}

function openSalidaModal(codigoPrefill=''){
  document.getElementById('formSalida').reset();
  document.getElementById('sCodigo').value = codigoPrefill;
  document.getElementById('sFecha').value = toDateInputValue(new Date());
  updateSalidaProductInfo();
  openModal('modalSalida');
}

function updateSalidaProductInfo(){
  const codigo = document.getElementById('sCodigo').value.trim();
  const box = document.getElementById('sProductInfo');
  const p = codigo ? getProducto(codigo) : null;
  if(!codigo){ box.className='product-info-box'; box.innerHTML=''; return; }
  if(p){
    const stock = computeStock(p.codigo);
    box.className = 'product-info-box visible';
    box.innerHTML = `📦 <strong>${escapeHtml(p.nombre)}</strong> — Stock disponible: <strong>${stock}</strong> · Precio sugerido: ${fmtMoney(p.precioVenta)}`;
    document.getElementById('sPrecioVenta').value = p.precioVenta;
  }else{
    box.className = 'product-info-box new visible';
    box.innerHTML = `⚠️ No existe ningún producto con este código.`;
  }
}

function handleSalidaSubmit(e){
  e.preventDefault();
  const codigo = document.getElementById('sCodigo').value.trim();
  const cantidad = parseInt(document.getElementById('sCantidad').value,10);
  const precioVenta = parseFloat(document.getElementById('sPrecioVenta').value);
  const cliente = document.getElementById('sCliente').value.trim();
  const fecha = document.getElementById('sFecha').value ? new Date(document.getElementById('sFecha').value).toISOString() : todayISO();
  const observacion = document.getElementById('sObservacion').value.trim();

  const p = getProducto(codigo);
  if(!p){ toast('No existe un producto con ese código', 'error'); return; }
  if(!cantidad || cantidad <= 0 || isNaN(precioVenta) || precioVenta < 0){
    toast('Completa cantidad y precio de venta correctamente', 'error'); return;
  }
  const stockDisponible = computeStock(codigo);
  if(cantidad > stockDisponible){
    toast(`No hay suficiente stock. Disponible: ${stockDisponible}`, 'error'); return;
  }

  const salida = { id: uid('salida'), codigo, precioVenta, cantidad, fecha, usuario:'admin', cliente, observacion };
  db.salidas.push(salida);
  saveDB();
  apiSyncSalida(salida);

  if(isStockBajo(p)) apiNotifyStockBajo(p);

  toast('Venta registrada correctamente', 'success');
  closeAllModals();
  renderVentas();
}

function deleteSalida(id){
  askConfirm('Eliminar venta', '¿Seguro que deseas eliminar este registro de venta? El stock se recalculará automáticamente.', ()=>{
    db.salidas = db.salidas.filter(s=>s.id !== Number(id));
    saveDB();
    closeAllModals();
    renderVentas();
    toast('Venta eliminada', 'success');
  });
}

/* -------------------------------------------------------------------------
   11. PEDIDOS (stock bajo mínimo)
   ------------------------------------------------------------------------- */

function getPedidosData(){
  return db.productos
    .filter(p=>p.activo)
    .map(p=>{
      const stock = computeStock(p.codigo);
      const minimo = p.stockMinimo ?? db.config.stockMinimoGlobal;
      const faltante = minimo - stock;
      return {p, stock, minimo, faltante};
    })
    .filter(x=>x.faltante > 0)
    .sort((a,b)=> b.faltante - a.faltante);
}

function renderPedidos(){
  const data = getPedidosData();
  const tbody = document.querySelector('#pedidosTable tbody');
  if(data.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No hay productos por debajo del stock mínimo 🎉</td></tr>`;
    document.getElementById('pedidosTotal').textContent = 'Total del pedido: ' + fmtMoney(0);
    return;
  }
  let total = 0;
  tbody.innerHTML = data.map(({p, stock, minimo, faltante})=>{
    const totalLinea = faltante * p.precioCompra;
    total += totalLinea;
    return `<tr class="row-low-stock">
      <td>${escapeHtml(p.codigo)}</td><td>${escapeHtml(p.nombre)}</td><td>${stock}</td>
      <td>${minimo}</td><td>${faltante}</td><td>${fmtMoney(p.precioCompra)}</td><td>${fmtMoney(totalLinea)}</td>
    </tr>`;
  }).join('');
  document.getElementById('pedidosTotal').textContent = 'Total del pedido: ' + fmtMoney(total);
}

function exportPedidosCSV(){
  const data = getPedidosData();
  if(data.length === 0){ toast('No hay pedidos para exportar', 'warning'); return; }
  const rows = [['CODIGO','NOMBRE','STOCK_ACTUAL','STOCK_MINIMO','FALTANTE','PRECIO_COMPRA','TOTAL']];
  data.forEach(({p, stock, minimo, faltante})=>{
    rows.push([p.codigo, p.nombre, stock, minimo, faltante, p.precioCompra.toFixed(2), (faltante*p.precioCompra).toFixed(2)]);
  });
  downloadCSV(rows, `pedidos_${toDateInputValue(new Date())}.csv`);
}

/* -------------------------------------------------------------------------
   12. CAJA DIARIA
   ------------------------------------------------------------------------- */

function renderCaja(){
  const fechaInput = document.getElementById('cajaFecha');
  if(!fechaInput.value) fechaInput.value = toDateInputValue(new Date());
  const fecha = fechaInput.value;

  const ventasDia = db.salidas.filter(s => s.fecha.slice(0,10) === fecha);
  let totalVentas = 0, totalGanancia = 0;
  ventasDia.forEach(s=>{
    const p = getProducto(s.codigo);
    totalVentas += s.cantidad * s.precioVenta;
    totalGanancia += computeGanancia(s.precioVenta, p?p.precioCompra:0, s.cantidad);
  });

  document.getElementById('cajaCards').innerHTML = `
    <div class="stat-card"><div class="stat-label">Ventas registradas</div><div class="stat-value">${ventasDia.length}</div></div>
    <div class="stat-card success"><div class="stat-label">Total vendido</div><div class="stat-value">${fmtMoney(totalVentas)}</div></div>
    <div class="stat-card success"><div class="stat-label">Ganancia del día</div><div class="stat-value">${fmtMoney(totalGanancia)}</div></div>
  `;

  const tbody = document.querySelector('#cajaVentasTable tbody');
  if(ventasDia.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No hay ventas registradas este día</td></tr>`;
    return;
  }
  tbody.innerHTML = ventasDia.sort((a,b)=> new Date(b.fecha)-new Date(a.fecha)).map(s=>{
    const p = getProducto(s.codigo);
    const ganancia = computeGanancia(s.precioVenta, p?p.precioCompra:0, s.cantidad);
    return `<tr>
      <td>${new Date(s.fecha).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'})}</td>
      <td>${escapeHtml(s.codigo)}</td><td>${escapeHtml(p?p.nombre:'-')}</td><td>${s.cantidad}</td>
      <td>${fmtMoney(s.precioVenta)}</td>
      <td class="${ganancia>=0?'money-pos':'money-neg'}">${fmtMoney(ganancia)}</td>
      <td>${escapeHtml(s.cliente||'-')}</td>
    </tr>`;
  }).join('');
}

/* -------------------------------------------------------------------------
   13. REPORTES
   ------------------------------------------------------------------------- */

function renderReportesInit(){
  if(!document.getElementById('repFechaDesde').value){
    const d = new Date(); d.setDate(d.getDate()-30);
    document.getElementById('repFechaDesde').value = toDateInputValue(d);
    document.getElementById('repFechaHasta').value = toDateInputValue(new Date());
  }
  generarReporte();
}

let ultimoReporte = null;

function generarReporte(){
  const desde = document.getElementById('repFechaDesde').value;
  const hasta = document.getElementById('repFechaHasta').value;

  const ventas = db.salidas.filter(s => (!desde || s.fecha.slice(0,10) >= desde) && (!hasta || s.fecha.slice(0,10) <= hasta));
  const compras = db.entradas.filter(e => (!desde || e.fecha.slice(0,10) >= desde) && (!hasta || e.fecha.slice(0,10) <= hasta));
  const gastos = db.gastos.filter(g => (!desde || g.fecha.slice(0,10) >= desde) && (!hasta || g.fecha.slice(0,10) <= hasta));

  const totalVentas = ventas.reduce((s,v)=> s + v.cantidad*v.precioVenta, 0);
  const totalCompras = compras.reduce((s,c)=> s + c.cantidad*c.precioCompra, 0);
  const totalGastos = gastos.reduce((s,g)=> s + Number(g.monto), 0);
  const utilidadNeta = totalVentas - totalCompras - totalGastos;

  ultimoReporte = {desde, hasta, ventas, totalVentas, totalCompras, totalGastos, utilidadNeta};

  document.getElementById('reporteCards').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total ventas</div><div class="stat-value">${fmtMoney(totalVentas)}</div></div>
    <div class="stat-card warning"><div class="stat-label">Total compras</div><div class="stat-value">${fmtMoney(totalCompras)}</div></div>
    <div class="stat-card danger"><div class="stat-label">Total gastos</div><div class="stat-value">${fmtMoney(totalGastos)}</div></div>
    <div class="stat-card ${utilidadNeta>=0?'success':'danger'}"><div class="stat-label">Utilidad neta</div><div class="stat-value">${fmtMoney(utilidadNeta)}</div></div>
  `;

  const tbody = document.querySelector('#reporteVentasTable tbody');
  if(ventas.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No hay ventas en este período</td></tr>`;
    return;
  }
  tbody.innerHTML = ventas.sort((a,b)=> new Date(b.fecha)-new Date(a.fecha)).map(s=>{
    const p = getProducto(s.codigo);
    const ganancia = computeGanancia(s.precioVenta, p?p.precioCompra:0, s.cantidad);
    return `<tr>
      <td>${fmtDateShort(s.fecha)}</td><td>${escapeHtml(s.codigo)}</td><td>${escapeHtml(p?p.nombre:'-')}</td>
      <td>${s.cantidad}</td><td>${fmtMoney(s.precioVenta)}</td>
      <td class="${ganancia>=0?'money-pos':'money-neg'}">${fmtMoney(ganancia)}</td><td>${escapeHtml(s.cliente||'-')}</td>
    </tr>`;
  }).join('');
}

function exportReporteCSV(){
  if(!ultimoReporte || ultimoReporte.ventas.length === 0){ toast('No hay datos para exportar', 'warning'); return; }
  const rows = [['FECHA','CODIGO','PRODUCTO','CANTIDAD','PRECIO_VENTA','GANANCIA','CLIENTE']];
  ultimoReporte.ventas.forEach(s=>{
    const p = getProducto(s.codigo);
    const ganancia = computeGanancia(s.precioVenta, p?p.precioCompra:0, s.cantidad);
    rows.push([fmtDateShort(s.fecha), s.codigo, p?p.nombre:'-', s.cantidad, s.precioVenta.toFixed(2), ganancia.toFixed(2), s.cliente||'']);
  });
  rows.push([]);
  rows.push(['RESUMEN']);
  rows.push(['Total ventas', ultimoReporte.totalVentas.toFixed(2)]);
  rows.push(['Total compras', ultimoReporte.totalCompras.toFixed(2)]);
  rows.push(['Total gastos', ultimoReporte.totalGastos.toFixed(2)]);
  rows.push(['Utilidad neta', ultimoReporte.utilidadNeta.toFixed(2)]);
  downloadCSV(rows, `reporte_${ultimoReporte.desde}_a_${ultimoReporte.hasta}.csv`);
}

/* -------------------------------------------------------------------------
   14. GASTOS
   ------------------------------------------------------------------------- */

function renderGastos(){
  const desde = document.getElementById('gastoFechaDesde').value;
  const hasta = document.getElementById('gastoFechaHasta').value;
  const cat = document.getElementById('gastoFiltroCategoria').value;

  let list = db.gastos.slice();
  if(desde) list = list.filter(g=> g.fecha.slice(0,10) >= desde);
  if(hasta) list = list.filter(g=> g.fecha.slice(0,10) <= hasta);
  if(cat) list = list.filter(g=> g.categoria === cat);
  list.sort((a,b)=> new Date(b.fecha)-new Date(a.fecha));

  const total = list.reduce((s,g)=> s+Number(g.monto), 0);
  document.getElementById('gastosTotal').textContent = 'Total gastos: ' + fmtMoney(total);

  const tbody = document.querySelector('#gastosTable tbody');
  if(list.length === 0){
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No hay gastos registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(g=>`
    <tr>
      <td>${fmtDateShort(g.fecha)}</td><td>${escapeHtml(g.concepto)}</td><td>${escapeHtml(g.categoria)}</td>
      <td>${fmtMoney(g.monto)}</td><td>${escapeHtml(g.observacion||'-')}</td>
      <td><button class="btn-icon" title="Eliminar" data-delete-gasto="${g.id}">🗑️</button></td>
    </tr>`).join('');
}

function handleGastoSubmit(e){
  e.preventDefault();
  const concepto = document.getElementById('gConcepto').value.trim();
  const categoria = document.getElementById('gCategoria').value;
  const monto = parseFloat(document.getElementById('gMonto').value);
  const fecha = document.getElementById('gFecha').value ? new Date(document.getElementById('gFecha').value).toISOString() : todayISO();
  const observacion = document.getElementById('gObservacion').value.trim();

  if(!concepto || isNaN(monto) || monto <= 0){ toast('Completa concepto y monto correctamente', 'error'); return; }

  db.gastos.push({ id: uid('gasto'), concepto, categoria, monto, fecha, observacion });
  saveDB();
  toast('Gasto registrado', 'success');
  closeAllModals();
  renderGastos();
}

function deleteGasto(id){
  askConfirm('Eliminar gasto', '¿Seguro que deseas eliminar este gasto?', ()=>{
    db.gastos = db.gastos.filter(g=>g.id !== Number(id));
    saveDB();
    closeAllModals();
    renderGastos();
    toast('Gasto eliminado', 'success');
  });
}

/* -------------------------------------------------------------------------
   15. CONFIGURACIÓN / BACKUP / RESET
   ------------------------------------------------------------------------- */

function renderConfig(){
  document.getElementById('cfgStockMinimo').value = db.config.stockMinimoGlobal;
  document.getElementById('cfgMoneda').value = db.config.moneda;
  document.getElementById('cfgApiUrl').value = getApiUrl();
}

function guardarConfig(){
  db.config.stockMinimoGlobal = parseInt(document.getElementById('cfgStockMinimo').value,10) || 0;
  db.config.moneda = document.getElementById('cfgMoneda').value.trim() || 'Bs';
  saveDB();
  toast('Configuración guardada', 'success');
  renderDashboard();
}

function exportBackup(){
  const data = JSON.stringify(db, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `backup_stockferre_${toDateInputValue(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado', 'success');
}

function importBackup(file){
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const data = JSON.parse(ev.target.result);
      if(!data.productos || !data.entradas || !data.salidas){
        toast('El archivo no tiene el formato esperado', 'error'); return;
      }
      db = data;
      db.gastos = db.gastos || [];
      db.config = db.config || {stockMinimoGlobal:5, moneda:'Bs'};
      db.contador = db.contador || {producto:1000, entrada:1, salida:1, gasto:1};
      saveDB();
      toast('Backup importado correctamente', 'success');
      showView('dashboard');
    }catch(err){
      toast('Error al leer el archivo JSON', 'error');
    }
  };
  reader.readAsText(file);
}

function factoryReset(){
  askConfirm('Restaurar datos de fábrica', 'Esto eliminará TODOS los datos actuales (productos, compras, ventas, gastos) y no se puede deshacer. ¿Continuar?', ()=>{
    db = defaultDB();
    seedSampleData();
    saveDB();
    closeAllModals();
    toast('Datos restaurados a valores de fábrica', 'success');
    showView('dashboard');
  });
}

/* -------------------------------------------------------------------------
   16. IMPORTACIÓN / EXPORTACIÓN CSV
   ------------------------------------------------------------------------- */

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim() !== '');
  if(lines.length === 0) return [];
  const detectSep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = lines[0].split(detectSep).map(h=>h.trim().toUpperCase().replace(/^\uFEFF/,''));
  return lines.slice(1).map(line=>{
    const cols = line.split(detectSep);
    const obj = {};
    headers.forEach((h,i)=> obj[h] = (cols[i]||'').trim());
    return obj;
  });
}

function downloadCSV(rows, filename){
  const csv = rows.map(r=> r.map(cell=>{
    const s = String(cell ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function importProductsCSV(file){
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const rows = parseCSV(ev.target.result);
    let creados = 0, omitidos = 0;
    rows.forEach(r=>{
      const codigo = r['CODIGO'];
      if(!codigo) return;
      if(getProducto(codigo)){ omitidos++; return; }
      db.productos.push({
        id: uid('producto'), codigo,
        nombre: r['DESCRIPCION'] || `Producto ${codigo}`,
        marca: r['MARCA'] || '', categoria: r['CATEGORIA'] || '',
        importadora: r['IMPORTADORA'] || '',
        precioVenta: parseFloat(r['PRECIO PARA VENTA']) || 0,
        precioCompra: parseFloat(r['PRECIO ULTIMO']) || 0,
        stockMinimo: db.config.stockMinimoGlobal, activo:true, fechaCreacion: todayISO()
      });
      creados++;
    });
    saveDB();
    toast(`Importación completa: ${creados} creados, ${omitidos} omitidos (código duplicado)`, 'success');
    renderProductos();
  };
  reader.readAsText(file);
}

function importComprasCSV(file){
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const rows = parseCSV(ev.target.result);
    let creados = 0;
    rows.forEach(r=>{
      const codigo = r['CODIGO'];
      if(!codigo) return;
      const cantidad = parseInt(r['CANTIDAD'],10) || 0;
      const precioCompra = parseFloat(r['PRECIO DE COMPRA']) || 0;
      const importadora = r['IMPORTADORA'] || '';
      const fecha = r['FECHA DE INGRESO'] ? new Date(r['FECHA DE INGRESO']).toISOString() : todayISO();
      if(cantidad <= 0) return;
      let p = getProducto(codigo);
      if(!p){
        p = { id: uid('producto'), codigo, nombre:`Producto ${codigo} (completar nombre)`,
          marca:'', categoria:'', importadora, precioCompra, precioVenta: precioCompra*1.3,
          stockMinimo: db.config.stockMinimoGlobal, activo:true, fechaCreacion: todayISO() };
        db.productos.push(p);
      }else{
        p.precioCompra = precioCompra;
      }
      db.entradas.push({ id: uid('entrada'), codigo, precioCompra, importadora, cantidad, fecha, usuario:'admin', observacion:'Importado desde CSV' });
      creados++;
    });
    saveDB();
    toast(`${creados} entradas importadas correctamente`, 'success');
    renderCompras();
  };
  reader.readAsText(file);
}

function importVentasCSV(file){
  const reader = new FileReader();
  reader.onload = (ev)=>{
    const rows = parseCSV(ev.target.result);
    let creados = 0, rechazados = 0;
    rows.forEach(r=>{
      const codigo = r['CODIGO'];
      if(!codigo) return;
      const cantidad = parseInt(r['CANTIDAD'],10) || 0;
      const precioVenta = parseFloat(r['PRECIO DE VENTA']) || 0;
      const fecha = r['FECHA DE VENTA'] ? new Date(r['FECHA DE VENTA']).toISOString() : todayISO();
      const p = getProducto(codigo);
      if(!p || cantidad <= 0){ rechazados++; return; }
      if(cantidad > computeStock(codigo)){ rechazados++; return; }
      db.salidas.push({ id: uid('salida'), codigo, precioVenta, cantidad, fecha, usuario:'admin', cliente:'', observacion:'Importado desde CSV' });
      creados++;
    });
    saveDB();
    toast(`${creados} salidas importadas, ${rechazados} rechazadas (sin stock o producto no existe)`, creados>0?'success':'warning');
    renderVentas();
  };
  reader.readAsText(file);
}

/* -------------------------------------------------------------------------
   17. ESCÁNER DE CÓDIGO DE BARRAS (html5-qrcode)
   ------------------------------------------------------------------------- */

let scanMode = 'info';
let html5QrCode = null;
let scannerRunning = false;

function openScannerModal(){
  document.getElementById('scanResult').innerHTML = '';
  document.getElementById('manualCodeInput').value = '';
  openModal('modalScanner');
  setTimeout(startScanner, 150);
}

function startScanner(){
  if(typeof Html5Qrcode === 'undefined'){
    document.getElementById('qr-reader').innerHTML = '<p class="hint">No se pudo cargar la librería del escáner. Verifica tu conexión a internet o usa la búsqueda manual.</p>';
    return;
  }
  html5QrCode = new Html5Qrcode('qr-reader');
  const config = { fps: 10, qrbox: { width: 250, height: 150 } };
  Html5Qrcode.getCameras().then(cameras=>{
    if(!cameras || cameras.length === 0){
      document.getElementById('qr-reader').innerHTML = '<p class="hint">No se detectó ninguna cámara. Usa la búsqueda manual abajo.</p>';
      return;
    }
    // Preferir cámara trasera si existe
    const backCam = cameras.find(c=> /back|trás|rear|environment/i.test(c.label)) || cameras[cameras.length-1];
    html5QrCode.start(backCam.id, config, onScanSuccess).then(()=>{
      scannerRunning = true;
    }).catch(err=>{
      console.warn(err);
      document.getElementById('qr-reader').innerHTML = '<p class="hint">No se pudo acceder a la cámara. Verifica los permisos o usa la búsqueda manual.</p>';
    });
  }).catch(err=>{
    console.warn(err);
    document.getElementById('qr-reader').innerHTML = '<p class="hint">No se pudo acceder a la cámara. Verifica los permisos o usa la búsqueda manual.</p>';
  });
}

function stopScanner(){
  if(html5QrCode && scannerRunning){
    html5QrCode.stop().then(()=>{
      html5QrCode.clear();
      scannerRunning = false;
    }).catch(()=>{});
  }
}

function onScanSuccess(decodedText){
  // Evita procesar el mismo código muchas veces por segundo
  if(window.__lastScan === decodedText && Date.now() - (window.__lastScanTime||0) < 2500) return;
  window.__lastScan = decodedText;
  window.__lastScanTime = Date.now();
  handleScannedCode(decodedText);
}

function handleScannedCode(codigo){
  codigo = codigo.trim();
  const p = getProducto(codigo);
  const resultDiv = document.getElementById('scanResult');

  if(scanMode === 'nuevo'){
    if(p){
      resultDiv.innerHTML = `<div class="scan-not-found">⚠️ Ya existe un producto con el código <strong>${escapeHtml(codigo)}</strong>: <strong>${escapeHtml(p.nombre)}</strong>. Puedes editarlo desde el módulo Productos.</div>`;
      return;
    }
    closeAllModals();
    openProductModal(null, codigo);
    return;
  }else if(scanMode === 'info'){
    if(!p){
      resultDiv.innerHTML = `<div class="scan-not-found">⚠️ No se encontró ningún producto con el código <strong>${escapeHtml(codigo)}</strong>.</div>`;
      return;
    }
    const stock = computeStock(p.codigo);
    resultDiv.innerHTML = `
      <div class="scan-result-card">
        <h4>📦 ${escapeHtml(p.nombre)}</h4>
        <div class="sr-row"><span>Código</span><strong>${escapeHtml(p.codigo)}</strong></div>
        <div class="sr-row"><span>Marca</span><strong>${escapeHtml(p.marca||'-')}</strong></div>
        <div class="sr-row"><span>Categoría</span><strong>${escapeHtml(p.categoria||'-')}</strong></div>
        <div class="sr-row"><span>Stock actual</span><strong>${stock}</strong></div>
        <div class="sr-row"><span>Precio de venta</span><strong>${fmtMoney(p.precioVenta)}</strong></div>
        <div class="sr-row"><span>Precio de llegada (compra)</span><strong>${fmtMoney(p.precioCompra)}</strong></div>
      </div>`;
  }else if(scanMode === 'compra'){
    closeAllModals();
    openEntradaModal(codigo);
  }else if(scanMode === 'venta'){
    if(!p){
      resultDiv.innerHTML = `<div class="scan-not-found">⚠️ No existe un producto con el código <strong>${escapeHtml(codigo)}</strong>. No se puede registrar una venta.</div>`;
      return;
    }
    closeAllModals();
    openSalidaModal(codigo);
  }
}

/* -------------------------------------------------------------------------
   18. EVENTOS / INICIALIZACIÓN
   ------------------------------------------------------------------------- */

function setupEventListeners(){
  // Navegación
  document.querySelectorAll('.nav-item[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=> showView(btn.dataset.view));
  });
  document.querySelectorAll('[data-action="open-scanner"]').forEach(btn=>{
    btn.addEventListener('click', openScannerModal);
  });

  // Sidebar móvil
  document.getElementById('hamburgerBtn').addEventListener('click', ()=>{
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebarMobile);

  // Cerrar modales
  document.querySelectorAll('[data-close-modal]').forEach(btn=>{
    btn.addEventListener('click', closeAllModals);
  });
  document.getElementById('modalBackdrop').addEventListener('click', closeAllModals);

  // Confirm modal
  document.getElementById('confirmAcceptBtn').addEventListener('click', ()=>{
    if(confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  // Productos
  document.getElementById('btnNewProduct').addEventListener('click', ()=> openProductModal());
  document.getElementById('formProducto').addEventListener('submit', handleProductSubmit);
  document.getElementById('prodSearch').addEventListener('input', renderProductos);
  document.getElementById('prodFilterCategoria').addEventListener('change', renderProductos);
  document.getElementById('prodFilterMarca').addEventListener('change', renderProductos);
  document.querySelector('#productsTable tbody').addEventListener('click', (e)=>{
    const editId = e.target.closest('[data-edit-product]')?.dataset.editProduct;
    const toggleId = e.target.closest('[data-toggle-product]')?.dataset.toggleProduct;
    if(editId) openProductModal(getProductoById(editId));
    if(toggleId) toggleProductoActivo(toggleId);
  });

  // Compras
  document.getElementById('btnNewCompra').addEventListener('click', ()=> openEntradaModal());
  document.getElementById('formEntrada').addEventListener('submit', handleEntradaSubmit);
  document.getElementById('eCodigo').addEventListener('input', updateEntradaProductInfo);
  document.getElementById('compraFechaDesde').addEventListener('change', renderCompras);
  document.getElementById('compraFechaHasta').addEventListener('change', renderCompras);
  document.getElementById('compraProductoFiltro').addEventListener('input', renderCompras);
  document.querySelector('#comprasTable tbody').addEventListener('click', (e)=>{
    const id = e.target.closest('[data-delete-entrada]')?.dataset.deleteEntrada;
    if(id) deleteEntrada(id);
  });

  // Ventas
  document.getElementById('btnNewVenta').addEventListener('click', ()=> openSalidaModal());
  document.getElementById('formSalida').addEventListener('submit', handleSalidaSubmit);
  document.getElementById('sCodigo').addEventListener('input', updateSalidaProductInfo);
  document.getElementById('ventaFechaDesde').addEventListener('change', renderVentas);
  document.getElementById('ventaFechaHasta').addEventListener('change', renderVentas);
  document.getElementById('ventaProductoFiltro').addEventListener('input', renderVentas);
  document.querySelector('#ventasTable tbody').addEventListener('click', (e)=>{
    const id = e.target.closest('[data-delete-salida]')?.dataset.deleteSalida;
    if(id) deleteSalida(id);
  });

  // Pedidos
  document.getElementById('btnRefreshPedidos').addEventListener('click', renderPedidos);
  document.getElementById('btnExportPedidos').addEventListener('click', exportPedidosCSV);

  // Caja
  document.getElementById('cajaFecha').addEventListener('change', renderCaja);

  // Reportes
  document.getElementById('btnGenerarReporte').addEventListener('click', generarReporte);
  document.getElementById('btnExportReporte').addEventListener('click', exportReporteCSV);

  // Gastos
  document.getElementById('btnNewGasto').addEventListener('click', ()=>{
    document.getElementById('formGasto').reset();
    document.getElementById('gFecha').value = toDateInputValue(new Date());
    openModal('modalGasto');
  });
  document.getElementById('formGasto').addEventListener('submit', handleGastoSubmit);
  document.getElementById('gastoFechaDesde').addEventListener('change', renderGastos);
  document.getElementById('gastoFechaHasta').addEventListener('change', renderGastos);
  document.getElementById('gastoFiltroCategoria').addEventListener('change', renderGastos);
  document.querySelector('#gastosTable tbody').addEventListener('click', (e)=>{
    const id = e.target.closest('[data-delete-gasto]')?.dataset.deleteGasto;
    if(id) deleteGasto(id);
  });

  // Configuración
  document.getElementById('btnGuardarConfig').addEventListener('click', guardarConfig);
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
  document.getElementById('btnImportBackup').addEventListener('click', ()=> document.getElementById('fileImportBackup').click());
  document.getElementById('fileImportBackup').addEventListener('change', (e)=>{
    if(e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btnFactoryReset').addEventListener('click', factoryReset);
  document.getElementById('btnGuardarApiUrl').addEventListener('click', ()=>{
    setApiUrl(document.getElementById('cfgApiUrl').value.trim());
    toast('URL de API guardada', 'success');
  });

  // Importaciones CSV
  document.getElementById('btnImportProducts').addEventListener('click', ()=> document.getElementById('fileImportProducts').click());
  document.getElementById('fileImportProducts').addEventListener('change', (e)=>{
    if(e.target.files[0]) importProductsCSV(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btnImportCompras').addEventListener('click', ()=> document.getElementById('fileImportCompras').click());
  document.getElementById('fileImportCompras').addEventListener('change', (e)=>{
    if(e.target.files[0]) importComprasCSV(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btnImportVentas').addEventListener('click', ()=> document.getElementById('fileImportVentas').click());
  document.getElementById('fileImportVentas').addEventListener('change', (e)=>{
    if(e.target.files[0]) importVentasCSV(e.target.files[0]);
    e.target.value = '';
  });

  // Escáner
  document.querySelectorAll('.scan-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.scan-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      scanMode = tab.dataset.scanMode;
      document.getElementById('scanResult').innerHTML = '';
    });
  });
  document.getElementById('btnManualCodeGo').addEventListener('click', ()=>{
    const val = document.getElementById('manualCodeInput').value.trim();
    if(val) handleScannedCode(val);
  });
  document.getElementById('manualCodeInput').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      const val = e.target.value.trim();
      if(val) handleScannedCode(val);
    }
  });
}

function init(){
  loadDB();
  setupEventListeners();
  showView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);

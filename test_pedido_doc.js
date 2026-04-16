// Test interno: verifica que pdProvBuildDd, pdProvSelect, pdProvCompletar y
// abrirCarpetaProyectoDrive funcionan correctamente sin bucles infinitos.
// También comprueba que loadPedidos fija los filtros correctamente.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Stub de fetch para Supabase y Apps Script
// IMPORTANTE: el código usa r.text() y parsea con JSON.parse, así que el text()
// del stub debe devolver el JSON serializado, no '[]' vacío.
let fetchCalls = 0;
const lastFetchUrls = [];
const mockProveedores = [
  { id: 'prov1', nombre: 'TOBISA',  tipo: 'Proveedor', telefono: '961234567' },
  { id: 'prov2', nombre: 'Genexia', tipo: 'Proveedor', telefono: '963456789' },
  { id: 'prov3', nombre: 'D Aqua',  tipo: 'Proveedor', telefono: null }
];
const mockProyectos = [
  { id:'p1', proyecto_id: 'PRY-022', nombre: 'Espejos',     cliente_id: 'CLI-H026', carpeta_drive: null },
  { id:'p2', proyecto_id: 'PRY-013', nombre: 'Reforma baño', cliente_id: 'CLI-H026', carpeta_drive: 'https://drive.google.com/drive/folders/abc123' }
];
const mockPedidos = [
  { id:1, num_pedido:'PED-037', fecha:'2026-04-16', proyecto_id:'PRY-022', tipo:'Material', proveedor:'Genexia', importe:0, estado:'Pendiente', observaciones:'Test', cliente_id:'CLI-H026', cliente_nombre:'Ana Maria', adjuntos:null },
  { id:2, num_pedido:'PED-038', fecha:'2026-04-16', proyecto_id:'PRY-013', tipo:'Material', proveedor:'Genexia', importe:0, estado:'Pendiente', cliente_id:'CLI-H026', adjuntos:null }
];
// Capturas para tests del Apps Script
let lastAppsScriptBody = null;
let appsScriptResponse = null; // si se asigna, sobreescribe la respuesta por defecto
const fetchStub = async (url, opts) => {
  fetchCalls++;
  lastFetchUrls.push(url);
  // Apps Script (Drive): URL del tipo script.google.com/macros/.../exec
  if(/script\.google\.com\/macros/.test(url)){
    try{ lastAppsScriptBody = JSON.parse(opts && opts.body); }catch(_){ lastAppsScriptBody = null; }
    const respObj = appsScriptResponse || { ok:true, url:'https://drive.google.com/drive/folders/SUB_DEFAULT' };
    const respTxt = JSON.stringify(respObj);
    return { ok:true, status:200, headers:new Map(),
      json: async()=>respObj, text: async()=>respTxt };
  }
  let data = [];
  if(url.includes('/rest/v1/proveedores')) data = mockProveedores;
  else if(url.includes('/rest/v1/proyectos')) data = mockProyectos;
  else if(url.includes('/rest/v1/pedidos')) data = mockPedidos;
  const txt = JSON.stringify(data);
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => data,
    text: async () => txt
  };
};

(async () => {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    beforeParse(window) {
      // Stub fetch
      window.fetch = fetchStub;
      // Stub localStorage already exists in jsdom
      // Stub alert/confirm/prompt
      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = () => 'https://drive.google.com/drive/folders/PARENT_FOLDER_TEST';
      // Capturar errores
      window.addEventListener('error', (e) => {
        console.error('[WINDOW ERROR]', e.message, e.filename+':'+e.lineno);
      });
    }
  });

  // Esperar a que los scripts se ejecuten
  await new Promise(r => setTimeout(r, 1000));

  const win = dom.window;
  const doc = win.document;

  let pass = 0, fail = 0;
  const test = (name, fn) => {
    try {
      const result = fn();
      if(result === true || result === undefined) {
        console.log('  ✓', name);
        pass++;
      } else {
        console.log('  ✗', name, '— resultado:', result);
        fail++;
      }
    } catch(e) {
      console.log('  ✗', name, '— ERROR:', e.message);
      fail++;
    }
  };

  console.log('\n═══ Test 1: existencia de funciones ═══');
  test('pdProvBuildDd está definida',     () => typeof win.pdProvBuildDd     === 'function');
  test('pdProvSelect está definida',      () => typeof win.pdProvSelect      === 'function');
  test('pdProvCompletar está definida',   () => typeof win.pdProvCompletar   === 'function');
  test('abrirCarpetaProyectoDrive está definida', () => typeof win.abrirCarpetaProyectoDrive === 'function');
  test('loadPedidos está definida',       () => typeof win.loadPedidos       === 'function');
  test('cascadaClienteProyecto definida', () => typeof win.cascadaClienteProyecto === 'function');
  test('crearCarpetasDrive definida',     () => typeof win.crearCarpetasDrive === 'function');

  console.log('\n═══ Test 2: elementos del DOM ═══');
  test('input pd-prov-input existe', () => !!doc.getElementById('pd-prov-input'));
  test('div pd-prov-dd existe',      () => !!doc.getElementById('pd-prov-dd'));
  test('input pd-ref-doc-input existe', () => !!doc.getElementById('pd-ref-doc-input'));
  // pd-prov-tel-input no existe en el documento actual; el código lo guarda con if(telInp).
  test('código guarda null en pd-prov-tel-input', () => {
    win.pdProvSelect('TOBISA', '961234567');
    return true; // si no lanza, pasa
  });
  test('input pd-prov-input tiene oninput', () => {
    const el = doc.getElementById('pd-prov-input');
    return el && el.getAttribute('oninput') && el.getAttribute('oninput').includes('pdProvBuildDd');
  });
  test('input pd-prov-input tiene onfocus', () => {
    const el = doc.getElementById('pd-prov-input');
    return el && el.getAttribute('onfocus') && el.getAttribute('onfocus').includes('pdProvBuildDd');
  });

  console.log('\n═══ Test 3: pdProvBuildDd no entra en bucle infinito ═══');
  // Forzar ProvC vacío usando eval para acceder al scope del script
  win.eval('ProvC = []');
  win._pdProvLoading = false;
  fetchCalls = 0;
  const t0 = Date.now();
  win.pdProvBuildDd();
  const tAfterFn = Date.now();
  test('pdProvBuildDd() retorna en <100ms (no se cuelga)', () => (tAfterFn - t0) < 100);
  test('fetch se llamó como mucho UNA vez (no recursión)', () => fetchCalls <= 1);
  // Esperar a que el fetch async se resuelva
  await new Promise(r => setTimeout(r, 600));
  const provCcount = win.eval('ProvC.length');
  test('ProvC se cargó tras async (>0)', () => provCcount > 0);
  test('_pdProvLoading se resetea a false tras carga', () => win._pdProvLoading === false);

  console.log('\n═══ Test 4: dropdown se renderiza con TODOS los proveedores ═══');
  // Asegurar input vacío para mostrar todos
  doc.getElementById('pd-prov-input').value = '';
  win.pdProvBuildDd();
  await new Promise(r => setTimeout(r, 50));
  const dd = doc.getElementById('pd-prov-dd');
  test('dropdown está visible (display!=none)', () => dd.style.display !== 'none');
  test('dropdown contiene items search-dd-item', () => dd.querySelectorAll('.search-dd-item').length === 3);
  test('dropdown contiene TOBISA',  () => dd.innerHTML.includes('TOBISA'));
  test('dropdown contiene Genexia', () => dd.innerHTML.includes('Genexia'));
  test('dropdown contiene D Aqua',  () => dd.innerHTML.includes('D Aqua'));

  console.log('\n═══ Test 5: filtrado por escritura ═══');
  doc.getElementById('pd-prov-input').value = 'tobi';
  win.pdProvBuildDd();
  await new Promise(r => setTimeout(r, 50));
  test('al escribir "tobi" muestra TOBISA', () => dd.innerHTML.includes('TOBISA'));
  test('al escribir "tobi" filtra fuera Genexia', () => !dd.innerHTML.includes('Genexia'));
  test('al escribir "tobi" filtra fuera D Aqua', () => !dd.innerHTML.includes('D Aqua'));

  console.log('\n═══ Test 6: pdProvSelect rellena nombre ═══');
  doc.getElementById('pd-prov-input').value = '';
  win.pdProvSelect('TOBISA', '961234567');
  test('input nombre se rellena con TOBISA', () => doc.getElementById('pd-prov-input').value === 'TOBISA');
  test('dropdown se cierra tras seleccionar', () => dd.style.display === 'none');

  console.log('\n═══ Test 7: abrirCarpetaProyectoDrive ═══');
  win.PC = [
    { id:'p1', proyecto_id: 'PRY-022', nombre: 'Espejos', cliente_id: 'CLI-H026', carpeta_drive: null },
    { id:'p2', proyecto_id: 'PRY-013', nombre: 'Reforma baño', cliente_id: 'CLI-H026', carpeta_drive: 'https://drive.google.com/drive/folders/abc123' }
  ];
  // window.open stub
  let openedUrl = null;
  win.open = (url) => { openedUrl = url; return null; };

  await win.abrirCarpetaProyectoDrive('PRY-013');
  test('proyecto con carpeta abre la URL en nueva pestaña', () => openedUrl === 'https://drive.google.com/drive/folders/abc123');

  // Proyecto inexistente
  openedUrl = null;
  await win.abrirCarpetaProyectoDrive('PRY-999-INEXISTENTE');
  test('proyecto inexistente NO abre URL', () => openedUrl === null);

  console.log('\n═══ Test 7b: Drive button cuando NO hay carpeta ofrece crear ═══');
  // Stub askDriveProyectosParentId para no abrir prompt
  win.localStorage.setItem('pau_drive_proyectos_parent_id', 'PARENT_FAKE_ID');
  // IMPORTANTE: la función real abrirCarpetaProyectoDrive lee la variable
  // PC con `let` (alcance del script). Para simular que crearCarpetasDrive
  // ha actualizado la carpeta del proyecto, modificamos la variable PC del
  // script vía eval, no la propiedad win.PC (que no es la misma).
  let createCalled = false;
  win.crearCarpetasDrive = async (proyId, nombre, parentId, dentro) => {
    createCalled = true;
    // Buscar dentro de PC del script y asignar carpeta_drive
    win.eval(
      "(function(){var p=(typeof PC!=='undefined'?PC:[]).find(function(x){return x.proyecto_id==='"+proyId+"'});" +
      "if(p) p.carpeta_drive='https://drive.google.com/drive/folders/CREATED_"+proyId+"';})()"
    );
  };
  openedUrl = null;
  await win.abrirCarpetaProyectoDrive('PRY-022');
  await new Promise(r=>setTimeout(r, 1200)); // dejar que el setTimeout de open() corra
  test('confirm aceptado → crearCarpetasDrive se llama', () => createCalled);
  test('tras crear carpeta, abre la nueva URL', () => openedUrl && openedUrl.includes('CREATED_PRY-022'));

  console.log('\n═══ Test 7c: abrirCarpetaPedidoDrive navega a 06 Proveedores/{Prov}/Pedidos ═══');
  test('abrirCarpetaPedidoDrive está definida', () => typeof win.abrirCarpetaPedidoDrive === 'function');
  test('_resolveDriveSubFolderUrl está definida', () => typeof win._resolveDriveSubFolderUrl === 'function');
  // Asegurar PC con proyecto que tiene carpeta_drive
  win.eval("PC = [{id:'p2', proyecto_id:'PRY-013', nombre:'Reforma baño', cliente_id:'CLI-H026', carpeta_drive:'https://drive.google.com/drive/folders/abc123'}]");
  // Stub respuesta Apps Script con URL de subcarpeta
  appsScriptResponse = { ok:true, url:'https://drive.google.com/drive/folders/SUB_GENEXIA_PEDIDOS', folderId:'SUB_GENEXIA_PEDIDOS' };
  lastAppsScriptBody = null;
  openedUrl = null;
  await win.abrirCarpetaPedidoDrive('PRY-013', 'Genexia');
  test('llamó al Apps Script con action=getSubFolderUrl', () => lastAppsScriptBody && lastAppsScriptBody.action === 'getSubFolderUrl');
  test('rootFolderId extraído correctamente de carpeta_drive', () => lastAppsScriptBody && lastAppsScriptBody.rootFolderId === 'abc123');
  test('path = ["06 Proveedores","Genexia","Pedidos"]', () => lastAppsScriptBody && JSON.stringify(lastAppsScriptBody.path) === '["06 Proveedores","Genexia","Pedidos"]');
  test('abrió la URL de subcarpeta devuelta por Apps Script', () => openedUrl === 'https://drive.google.com/drive/folders/SUB_GENEXIA_PEDIDOS');

  console.log('\n═══ Test 7d: sin proveedor → solo navega a 06 Proveedores ═══');
  appsScriptResponse = { ok:true, url:'https://drive.google.com/drive/folders/SUB_06_PROV' };
  lastAppsScriptBody = null;
  openedUrl = null;
  await win.abrirCarpetaPedidoDrive('PRY-013', '');
  test('path solo contiene "06 Proveedores"', () => lastAppsScriptBody && JSON.stringify(lastAppsScriptBody.path) === '["06 Proveedores"]');
  test('abrió la URL devuelta', () => openedUrl === 'https://drive.google.com/drive/folders/SUB_06_PROV');

  console.log('\n═══ Test 7e: fallback a raíz si Apps Script no responde bien ═══');
  appsScriptResponse = { ok:false, error:'getSubFolderUrl no implementada' };
  openedUrl = null;
  await win.abrirCarpetaPedidoDrive('PRY-013', 'Genexia');
  test('fallback abre la raíz del proyecto', () => openedUrl === 'https://drive.google.com/drive/folders/abc123');
  // restaurar para no contaminar tests siguientes
  appsScriptResponse = null;

  console.log('\n═══ Test 8: render de la tabla pedidos incluye botón Drive ═══');
  // Escenario realista: el usuario acaba de guardar un pedido y aterriza en
  // la página de pedidos. _pedidoRecienGuardado activa el filtro de proyecto
  // para que la fila sea visible (sin esto, filtrarModuloPorProyecto pinta
  // un empty state al final de loadPedidos).
  win.eval('PC = []; PedC = [];');
  win._pedidoRecienGuardado = { id:1, cliente_id:'CLI-H026', proyecto_id:'PRY-022' };
  win.pdPedidoId = null;
  await win.loadPedidos();
  await new Promise(r=>setTimeout(r,100));
  const tb = doc.getElementById('pedidos-tbody');
  // Debug: si falla, dump del HTML para diagnosticar
  if(!tb || !tb.innerHTML.includes("abrirCarpetaProyectoDrive('PRY-022')")){
    console.log('  [DEBUG] tb.innerHTML =', (tb && tb.innerHTML || '').slice(0,800));
    console.log('  [DEBUG] PC =', win.eval('JSON.stringify(PC)').slice(0,300));
    console.log('  [DEBUG] PedC =', win.eval('JSON.stringify(PedC)').slice(0,300));
  }
  // Verificamos que existe al menos una fila REAL (data-search), no solo el empty state
  test('tabla pedidos tiene una fila de datos', () => tb && tb.querySelectorAll('tr[data-search]').length >= 1);
  // El proyecto p1 NO tiene carpeta_drive en mockProyectos → debe mostrar botón "Crear"
  // que sigue usando abrirCarpetaProyectoDrive (no el helper de pedido)
  test('fila contiene botón con onclick abrirCarpetaProyectoDrive (sin carpeta)', () => tb && tb.innerHTML.includes("abrirCarpetaProyectoDrive('PRY-022')"));
  test('botón Drive (sin carpeta) muestra "Crear"', () => tb && tb.innerHTML.includes('📁 Crear'));

  console.log('\n═══ Test 8b: cuando el proyecto SÍ tiene carpeta, botón usa abrirCarpetaPedidoDrive ═══');
  // Vaciar caches para forzar re-fetch desde stub (que ya incluye PED-038 con PRY-013)
  win.eval('PC = []; PedC = [];');
  win._pedidoRecienGuardado = { id:2, cliente_id:'CLI-H026', proyecto_id:'PRY-013' };
  win.pdPedidoId = null;
  await win.loadPedidos();
  await new Promise(r=>setTimeout(r,100));
  test('botón usa abrirCarpetaPedidoDrive con proveedor', () => tb && tb.innerHTML.includes("abrirCarpetaPedidoDrive('PRY-013','Genexia')"));
  test('botón Drive (con carpeta) muestra "📁 Drive"', () => tb && tb.innerHTML.includes('📁 Drive'));

  console.log('\n═══ Test 9: loadPedidos fija filtros tras guardar ═══');
  // PC y PedC son `let` en el script (no window.PC), por eso usamos win.eval
  // para sobrescribir la variable real. Ponemos PC vacío para que loadPedidos
  // re-fetch via stub (mockProyectos incluye PRY-022 y PRY-013).
  win.eval('PC = []; PedC = [];');
  win._pedidoRecienGuardado = { id:1, cliente_id:'CLI-H026', proyecto_id:'PRY-022' };
  await win.loadPedidos();
  await new Promise(r => setTimeout(r, 100));
  const cliFil = doc.getElementById('filter-cliente-pedidos');
  const proyFil = doc.getElementById('filter-proyecto-pedidos');
  test('filter-cliente-pedidos = CLI-H026', () => cliFil && cliFil.value === 'CLI-H026');
  test('filter-proyecto-pedidos = PRY-022', () => proyFil && proyFil.value === 'PRY-022');
  test('_pedidoRecienGuardado se consume (queda null)', () => win._pedidoRecienGuardado === null);

  console.log('\n═══ RESULTADO ═══');
  console.log(`  ✓ ${pass} pasados`);
  console.log(`  ✗ ${fail} fallados`);
  process.exit(fail > 0 ? 1 : 0);
})();

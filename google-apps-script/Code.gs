// ═══════════════════════════════════════════════════════════════════════
// Google Apps Script — PAU INTERIORISMO — Gestión de archivos en Drive
// ═══════════════════════════════════════════════════════════════════════
//
// INSTRUCCIONES:
// 1. Abre https://script.google.com y abre tu proyecto existente
//    (el que tiene la URL AKfycbxsSebGjLyu0VecIKtBMk7adJ_8ki4...)
// 2. Reemplaza TODO el contenido de Code.gs con este archivo
// 3. Pon tu ID de carpeta raíz en PARENT_FOLDER_ID (línea de abajo)
// 4. Implementar > Nueva implementación > App web
//    - Ejecutar como: Tu cuenta
//    - Acceso: Cualquier persona
// 5. Copia la nueva URL y actualiza DRIVE_SCRIPT_URL en index.html
//    (solo si la URL cambia; si haces "Gestionar implementaciones" y
//     editas la existente, la URL se mantiene)
//
// ═══════════════════════════════════════════════════════════════════════

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────
// ID de la carpeta raíz de Drive donde se crean los proyectos.
// Para obtenerlo: abre la carpeta en Drive, la URL será
//   https://drive.google.com/drive/folders/XXXXXXXXX  ← ese es el ID
var PARENT_FOLDER_ID = '';  // ⚠️ PON AQUÍ TU ID — déjalo vacío para usar la raíz de Mi unidad

// ═══════════════════════════════════════════════════════════════════════
// PUNTO DE ENTRADA — doPost
// ═══════════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ─── Acción: uploadFile ────────────────────────────────────────
    if (data.action === 'uploadFile') {
      return _uploadFile(data);
    }

    // ─── Acción por defecto: crear carpetas de proyecto ───────────
    if (data.nombre && data.carpetas) {
      return _crearCarpetasProyecto(data);
    }

    return _json({ ok: false, error: 'Acción no reconocida' });

  } catch (err) {
    return _json({ ok: false, error: err.message || String(err) });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CREAR CARPETAS DE PROYECTO
// ═══════════════════════════════════════════════════════════════════════
// Input:  { nombre: "PRY-004 Nombre proyecto", carpetas: ["01 Mediciones", ...] }
// Output: { ok: true, url: "https://drive.google.com/drive/folders/..." }

function _crearCarpetasProyecto(data) {
  var parent = PARENT_FOLDER_ID
    ? DriveApp.getFolderById(PARENT_FOLDER_ID)
    : DriveApp.getRootFolder();

  // Buscar si ya existe una carpeta con ese nombre
  var existing = parent.getFoldersByName(data.nombre);
  var projectFolder;
  if (existing.hasNext()) {
    projectFolder = existing.next();
  } else {
    projectFolder = parent.createFolder(data.nombre);
  }

  // Crear subcarpetas
  if (data.carpetas && data.carpetas.length) {
    for (var i = 0; i < data.carpetas.length; i++) {
      var subName = data.carpetas[i];
      var subExisting = projectFolder.getFoldersByName(subName);
      if (!subExisting.hasNext()) {
        projectFolder.createFolder(subName);
      }
    }
  }

  var url = 'https://drive.google.com/drive/folders/' + projectFolder.getId();
  return _json({ ok: true, url: url, folderId: projectFolder.getId() });
}

// ═══════════════════════════════════════════════════════════════════════
// SUBIR ARCHIVO A DRIVE
// ═══════════════════════════════════════════════════════════════════════
// Input: {
//   action: 'uploadFile',
//   fileData: 'data:application/pdf;base64,...' o base64 puro,
//   fileName: 'documento.pdf',
//   mimeType: 'application/pdf',
//   folderId: 'ID de carpeta raíz del proyecto',
//   subCarpeta: '06 Proveedores'  (un solo nivel — compatibilidad),
//   subCarpetas: ['06 Proveedores', 'Mármoles Santamaría', 'Facturas']  (multinivel),
//   tipoDoc: 'Facturas',
//   proveedor: 'Nombre proveedor',
//   skipIfDuplicate: true
// }
// Output: { ok: true, fileUrl: '...' } | { ok: true, duplicate: true } | { ok: false, error: '...' }

function _uploadFile(data) {
  if (!data.folderId) {
    return _json({ ok: false, error: 'folderId requerido' });
  }
  if (!data.fileData) {
    return _json({ ok: false, error: 'fileData requerido' });
  }

  // ── Determinar carpeta destino ──────────────────────────────────
  var targetFolder = DriveApp.getFolderById(data.folderId);

  // Opción A: subCarpetas (array) — crear/navegar jerarquía de carpetas
  //   Ej: ['06 Proveedores', 'Mármoles Santamaría', 'Facturas']
  if (data.subCarpetas && data.subCarpetas.length > 0) {
    for (var i = 0; i < data.subCarpetas.length; i++) {
      targetFolder = _getOrCreateSubfolder(targetFolder, data.subCarpetas[i]);
    }
  }
  // Opción B: subCarpeta (string) — un solo nivel (compatibilidad)
  else if (data.subCarpeta) {
    targetFolder = _getOrCreateSubfolder(targetFolder, data.subCarpeta);
  }

  // ── Decodificar base64 ──────────────────────────────────────────
  var b64 = data.fileData;
  // Quitar prefijo data URI si existe: "data:application/pdf;base64,XXXX"
  var commaIdx = b64.indexOf(',');
  if (commaIdx > -1 && commaIdx < 100) {
    b64 = b64.substring(commaIdx + 1);
  }

  var decoded = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(decoded, data.mimeType || 'application/pdf', data.fileName || 'documento.pdf');

  // ── Evitar duplicados si se pide ────────────────────────────────
  if (data.skipIfDuplicate) {
    var existingFiles = targetFolder.getFilesByName(data.fileName || 'documento.pdf');
    if (existingFiles.hasNext()) {
      return _json({ ok: true, duplicate: true, message: 'Archivo ya existe' });
    }
  }

  // ── Subir archivo ───────────────────────────────────────────────
  var file = targetFolder.createFile(blob);
  var fileUrl = file.getUrl();

  return _json({
    ok: true,
    fileUrl: fileUrl,
    fileId: file.getId(),
    fileName: file.getName(),
    folderUrl: 'https://drive.google.com/drive/folders/' + targetFolder.getId()
  });
}

// ═══════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════

// Busca una subcarpeta por nombre dentro de parent. Si no existe, la crea.
function _getOrCreateSubfolder(parent, name) {
  if (!name) return parent;
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

// Devuelve ContentService JSON response
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================================
 *  PAU INTERIORISMO — Apps Script: acciones de aceptación digital
 * ============================================================================
 *
 *  Este snippet añade DOS nuevas acciones al doPost del Apps Script de Drive
 *  (el mismo que ya gestiona uploadFile, getSubFolderUrl y sendEmail):
 *
 *    • action: 'consultarTokenAceptacion'  → la página aceptar.html lo usa
 *      al cargar para mostrar el presupuesto al cliente.
 *
 *    • action: 'aceptarPresupuesto'        → la página aceptar.html lo llama
 *      cuando el cliente firma. Registra la auditoría y envía notificaciones.
 *
 *  ──────────────────────────────────────────────────────────────────────────
 *  REQUISITOS PREVIOS
 *  ──────────────────────────────────────────────────────────────────────────
 *
 *  1. Ejecutar en Supabase el SQL de:
 *       scripts/presupuesto_aceptaciones_schema.sql
 *
 *  2. Obtener el SERVICE_ROLE key de Supabase
 *     (Dashboard → Settings → API → Project API keys → service_role).
 *     ⚠️ Es una clave SECRETA: solo va aquí dentro de Apps Script.
 *     Nunca pegarla en el frontend ni en GitHub.
 *
 *  3. Pegarla en SUPABASE_SERVICE_KEY abajo.
 *
 *  ──────────────────────────────────────────────────────────────────────────
 *  PASOS PARA DESPLEGAR
 *  ──────────────────────────────────────────────────────────────────────────
 *
 *  a) Abre el Apps Script de Drive (el mismo de DRIVE_SCRIPT_URL).
 *  b) Pega el bloque de constantes SUPABASE_* arriba del archivo (después
 *     de cualquier otro `const`/`var` que ya haya).
 *  c) Pega los dos `if (data.action === ...)` dentro de doPost,
 *     ANTES del `return _jsonResponse(_crearCarpetas(data))` final.
 *  d) Pega las funciones `_consultarTokenAceptacion`, `_aceptarPresupuesto`
 *     y los helpers al final del archivo.
 *  e) Ctrl+S → Implementar → Gestionar implementaciones → editar →
 *     Nueva versión → Implementar.
 *
 * ============================================================================
 */


// ═══════════════════════════════════════════════════════════════════════════
//  1) CONSTANTES — pegar arriba del archivo Codigo.gs
// ═══════════════════════════════════════════════════════════════════════════

var SUPABASE_URL          = 'https://qxyflndntpmcdbyvwjnj.supabase.co';
var SUPABASE_SERVICE_KEY  = 'PEGAR_AQUI_EL_SERVICE_ROLE_KEY';   // ⚠️ SECRETA
var APP_PUBLIC_URL        = 'https://TU-DOMINIO/aceptar.html';   // ⚠️ EDITAR
var INTERNAL_NOTIF_EMAIL  = 'administracion@pauinteriorismo.es'; // copia interna


// ═══════════════════════════════════════════════════════════════════════════
//  2) ACCIONES NUEVAS — pegar dentro de doPost(), antes del return final
// ═══════════════════════════════════════════════════════════════════════════
//
//    if (data.action === 'consultarTokenAceptacion') {
//      return _jsonResponse(_consultarTokenAceptacion(data));
//    }
//    if (data.action === 'aceptarPresupuesto') {
//      return _jsonResponse(_aceptarPresupuesto(data, e));
//    }


// ═══════════════════════════════════════════════════════════════════════════
//  3) FUNCIONES — pegar al final del archivo Codigo.gs
// ═══════════════════════════════════════════════════════════════════════════


/**
 * Consulta un token de aceptación. Devuelve el snapshot del presupuesto
 * para mostrarlo en aceptar.html.
 *
 * Input:  { token: 'abc123...' }
 * Output: { ok:true, presupuesto:{ ref, snapshot_html, snapshot_total,
 *           cliente_email, expires_at, accepted_at, accepted_by_name } }
 *         { ok:false, error:'Token no encontrado' | 'Token caducado' }
 */
function _consultarTokenAceptacion(data) {
  try {
    var token = (data.token || '').toString().trim();
    if (!token) return { ok: false, error: 'Falta token' };

    var rows = _sbSelect('presupuesto_aceptaciones',
      'token=eq.' + encodeURIComponent(token) + '&select=*');

    if (!rows || rows.length === 0) {
      return { ok: false, error: 'Enlace no válido o expirado' };
    }

    var row = rows[0];

    // Comprobar caducidad
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { ok: false, error: 'Este enlace ha caducado' };
    }

    return {
      ok: true,
      presupuesto: {
        ref:                  row.presupuesto_ref,
        proyecto_id:          row.proyecto_id,
        cliente_email:        row.cliente_email,
        sender_email:         row.sender_email,
        snapshot_html:        row.snapshot_html || '',
        snapshot_total:       row.snapshot_total,
        expires_at:           row.expires_at,
        accepted_at:          row.accepted_at,
        accepted_by_name:     row.accepted_by_name,
        // Datos del anticipo (si se solicitó al enviar). Si no, vendrán null.
        anticipo_porcentaje:  row.anticipo_porcentaje,
        anticipo_importe:     row.anticipo_importe,
        anticipo_iban:        row.anticipo_iban,
        anticipo_concepto:    row.anticipo_concepto,
        factura_serie:        row.factura_serie
      }
    };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}


/**
 * Registra la aceptación firmada por el cliente.
 *
 * Input:  { token, nombre, dni, ip, userAgent }
 * Output: { ok:true, aceptado_at:'...' }
 *         { ok:false, error:'...' }
 */
function _aceptarPresupuesto(data, e) {
  try {
    var token     = (data.token     || '').toString().trim();
    var nombre    = (data.nombre    || '').toString().trim();
    var dni       = (data.dni       || '').toString().trim();
    var ip        = (data.ip        || '').toString().trim();
    var userAgent = (data.userAgent || '').toString().trim();

    if (!token)  return { ok: false, error: 'Falta token' };
    if (!nombre) return { ok: false, error: 'Falta nombre' };
    if (!dni)    return { ok: false, error: 'Falta DNI' };

    // Validar DNI formato básico (8 dígitos + letra, o NIE)
    if (!/^([0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z])$/.test(dni.replace(/[\s-]/g, ''))) {
      return { ok: false, error: 'Formato de DNI/NIE no válido' };
    }

    // Cargar registro existente
    var rows = _sbSelect('presupuesto_aceptaciones',
      'token=eq.' + encodeURIComponent(token) + '&select=*');

    if (!rows || rows.length === 0) {
      return { ok: false, error: 'Token no encontrado' };
    }

    var row = rows[0];

    if (row.accepted_at) {
      return { ok: false, error: 'Este presupuesto ya fue aceptado el ' + row.accepted_at };
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { ok: false, error: 'Este enlace ha caducado' };
    }

    var nowIso = new Date().toISOString();

    // Actualizar fila con datos de aceptación
    _sbUpdate('presupuesto_aceptaciones',
      'token=eq.' + encodeURIComponent(token),
      {
        accepted_at:         nowIso,
        accepted_by_name:    nombre,
        accepted_by_dni:     dni.toUpperCase(),
        accepted_ip:         ip || null,
        accepted_user_agent: userAgent || null
      });

    // Determinar el alias del remitente original (el que envió el presupuesto).
    // Si no se guardó (registros antiguos), usar el correo interno por defecto.
    var senderEmail = (row.sender_email && String(row.sender_email).trim())
                        ? String(row.sender_email).trim()
                        : INTERNAL_NOTIF_EMAIL;

    // Bloque HTML con los datos del anticipo (si se solicitó al enviar el presupuesto).
    // Devuelve '' si no hay anticipo configurado.
    var payInfoCliente = _buildPayInfoHtmlCliente(row);
    var payInfoInterno = _buildPayInfoHtmlInterno(row);

    // Notificación al cliente (confirmación) — desde el mismo alias que envió el presupuesto
    try {
      var htmlCliente =
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">' +
        '<p>Hola ' + _escapeHtml(nombre) + ',</p>' +
        '<p>Confirmamos que has aceptado el presupuesto <b>' +
          _escapeHtml(row.presupuesto_ref) + '</b> el ' +
          new Date(nowIso).toLocaleString('es-ES') + '.</p>' +
        '<p>Hemos recibido tus datos correctamente y procederemos con los siguientes pasos.</p>' +
        '<p>Datos registrados:</p>' +
        '<ul>' +
          '<li>Nombre: ' + _escapeHtml(nombre) + '</li>' +
          '<li>DNI/NIE: ' + _escapeHtml(dni.toUpperCase()) + '</li>' +
          '<li>Fecha: ' + new Date(nowIso).toLocaleString('es-ES') + '</li>' +
        '</ul>' +
        payInfoCliente +
        '<p>Un saludo,<br>Pau Interiorismo</p>' +
        '</div>';

      GmailApp.sendEmail(row.cliente_email,
        'Confirmación de aceptación · ' + row.presupuesto_ref,
        '',
        {
          htmlBody: htmlCliente,
          name:     'Pau Interiorismo',
          from:     senderEmail,
          replyTo:  senderEmail
        });
    } catch (err) { Logger.log('No se pudo enviar email cliente: ' + err); }

    // Notificación interna — al MISMO alias desde el que se envió el presupuesto
    try {
      var htmlInterno =
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333;">' +
        '<h3 style="color:#16a34a;">✅ Presupuesto aceptado</h3>' +
        '<p><b>Referencia:</b> ' + _escapeHtml(row.presupuesto_ref) + '<br>' +
        '<b>Proyecto:</b> ' + _escapeHtml(row.proyecto_id) + '<br>' +
        '<b>Cliente email:</b> ' + _escapeHtml(row.cliente_email) + '<br>' +
        '<b>Enviado desde:</b> ' + _escapeHtml(senderEmail) + '<br>' +
        '<b>Aceptado por:</b> ' + _escapeHtml(nombre) + ' (DNI: ' + _escapeHtml(dni.toUpperCase()) + ')<br>' +
        '<b>Fecha:</b> ' + new Date(nowIso).toLocaleString('es-ES') + '<br>' +
        '<b>IP:</b> ' + _escapeHtml(ip || '—') + '<br>' +
        '<b>Navegador:</b> ' + _escapeHtml(userAgent || '—') + '</p>' +
        (row.snapshot_total != null
          ? '<p><b>Importe presupuesto:</b> ' + _formatEUR(row.snapshot_total) + '</p>'
          : '') +
        payInfoInterno +
        '</div>';

      GmailApp.sendEmail(senderEmail,
        '[ACEPTADO] ' + row.presupuesto_ref + ' · ' + row.proyecto_id,
        '',
        {
          htmlBody: htmlInterno,
          name:     'Pau Interiorismo · Sistema',
          from:     senderEmail
        });
    } catch (err) { Logger.log('No se pudo enviar email interno: ' + err); }

    return { ok: true, aceptado_at: nowIso };

  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS Supabase REST (usan SERVICE_ROLE → bypassan RLS)
// ═══════════════════════════════════════════════════════════════════════════

function _sbSelect(table, queryString) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + queryString;
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
    },
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase SELECT ' + code + ': ' + resp.getContentText());
  }
  return JSON.parse(resp.getContentText() || '[]');
}

function _sbInsert(table, payload) {
  var url = SUPABASE_URL + '/rest/v1/' + table;
  var resp = UrlFetchApp.fetch(url, {
    method:  'post',
    contentType: 'application/json',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Prefer':        'return=representation'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase INSERT ' + code + ': ' + resp.getContentText());
  }
  return JSON.parse(resp.getContentText() || '[]');
}

function _sbUpdate(table, queryString, payload) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?' + queryString;
  var resp = UrlFetchApp.fetch(url, {
    method:  'patch',
    contentType: 'application/json',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Prefer':        'return=representation'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase UPDATE ' + code + ': ' + resp.getContentText());
  }
  return JSON.parse(resp.getContentText() || '[]');
}

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Formatea un importe numérico como string en formato EUR ("1.234,56 €").
function _formatEUR(n) {
  if (n == null || isNaN(n)) return '—';
  var v = Number(n).toFixed(2);
  // Separador de miles . y decimal ,
  var parts = v.split('.');
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intPart + ',' + parts[1] + ' €';
}

// Devuelve true si el registro tiene un anticipo configurado válido.
function _hasAnticipo(row) {
  return row && row.anticipo_porcentaje && Number(row.anticipo_porcentaje) > 0
              && row.anticipo_iban && String(row.anticipo_iban).trim();
}

// Bloque HTML "datos para el pago" que se inyecta en el email AL CLIENTE.
// Estilo coherente con aceptar.html (cajetín dorado).
function _buildPayInfoHtmlCliente(row) {
  if (!_hasAnticipo(row)) return '';
  var importe  = _formatEUR(row.anticipo_importe);
  var pct      = row.anticipo_porcentaje ? (' (' + Number(row.anticipo_porcentaje) + '% del total)') : '';
  var iban     = String(row.anticipo_iban || '').trim();
  var concepto = String(row.anticipo_concepto || '').trim() || 'Anticipo presupuesto';
  return ''
    + '<div style="margin:18px 0;padding:16px;background:#fff8f0;border:1px solid #e8c99a;border-radius:8px;">'
    +   '<div style="font-weight:700;color:#b87333;font-size:14px;margin-bottom:10px;">💰 Datos para realizar el pago</div>'
    +   '<table cellpadding="0" cellspacing="0" border="0" style="width:100%;font-size:13px;color:#4a3728;">'
    +     '<tr><td style="padding:4px 0;color:#9c7a4d;width:140px;">Importe a transferir:</td>'
    +         '<td style="padding:4px 0;font-weight:700;color:#b87333;font-size:15px;">' + importe + pct + '</td></tr>'
    +     '<tr><td style="padding:4px 0;color:#9c7a4d;">Beneficiario:</td>'
    +         '<td style="padding:4px 0;font-weight:600;">Pau Interiorismo S.L.</td></tr>'
    +     '<tr><td style="padding:4px 0;color:#9c7a4d;">IBAN:</td>'
    +         '<td style="padding:4px 0;font-family:Consolas,Monaco,monospace;font-weight:600;letter-spacing:.5px;">' + _escapeHtml(iban) + '</td></tr>'
    +     '<tr><td style="padding:4px 0;color:#9c7a4d;">Concepto:</td>'
    +         '<td style="padding:4px 0;font-weight:600;">' + _escapeHtml(concepto) + '</td></tr>'
    +   '</table>'
    +   '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e8c99a;font-size:12px;color:#6b7280;line-height:1.5;">'
    +     'En cuanto recibamos tu transferencia te enviaremos el recibo / factura del pago por email.'
    +   '</div>'
    + '</div>';
}

// Bloque HTML "datos del cobro pendiente" que se inyecta en el email INTERNO.
// Más compacto que el del cliente, orientado a información de gestión.
function _buildPayInfoHtmlInterno(row) {
  if (!_hasAnticipo(row)) return '';
  var importe  = _formatEUR(row.anticipo_importe);
  var pct      = row.anticipo_porcentaje ? Number(row.anticipo_porcentaje) : null;
  var iban     = String(row.anticipo_iban || '').trim();
  var concepto = String(row.anticipo_concepto || '').trim();
  var serie    = row.factura_serie ? Number(row.factura_serie) : null;
  var serieTxt = serie === 1 ? 'Serie 1 · Construcción' : (serie === 2 ? 'Serie 2 · Interiorismo' : '—');
  return ''
    + '<div style="margin-top:14px;padding:12px;background:#fff8f0;border-left:4px solid #b87333;border-radius:4px;">'
    +   '<div style="font-weight:700;color:#b87333;font-size:13px;margin-bottom:6px;">⏳ Anticipo pendiente de cobro</div>'
    +   '<p style="margin:4px 0;font-size:13px;">'
    +     '<b>Importe:</b> ' + importe + (pct!=null ? ' (' + pct + '%)' : '') + '<br>'
    +     '<b>IBAN cobro:</b> ' + _escapeHtml(iban) + '<br>'
    +     '<b>Concepto:</b> ' + _escapeHtml(concepto || '—') + '<br>'
    +     '<b>Serie factura:</b> ' + serieTxt
    +   '</p>'
    +   '<div style="font-size:11px;color:#9c7a4d;margin-top:6px;">Cuando llegue la transferencia, márcala como cobrada en la app para emitir la factura automáticamente.</div>'
    + '</div>';
}


// ═══════════════════════════════════════════════════════════════════════════
//  TEST RÁPIDO desde el editor (opcional)
// ═══════════════════════════════════════════════════════════════════════════
//
//  function testConsultarToken() {
//    Logger.log(_consultarTokenAceptacion({ token: 'PEGAR_TOKEN_DE_PRUEBA' }));
//  }
//
//  function testAceptar() {
//    Logger.log(_aceptarPresupuesto({
//      token: 'PEGAR_TOKEN_DE_PRUEBA',
//      nombre: 'Juan Pérez',
//      dni: '12345678Z',
//      ip: '127.0.0.1',
//      userAgent: 'TestRunner'
//    }));
//  }
//
// ============================================================================

/**
 * ============================================================================
 *  PAU INTERIORISMO — Apps Script: acción 'sendEmail'
 * ============================================================================
 *
 *  Este snippet hay que pegarlo dentro del MISMO Apps Script que ya gestiona
 *  Drive (DRIVE_SCRIPT_URL en index.html). Añade un nuevo case 'sendEmail' al
 *  switch principal de doPost.
 *
 *  REQUISITOS PREVIOS EN GMAIL (https://mail.google.com/mail/u/0/#settings/accounts):
 *    Sección «Enviar como». Confirma que estos 3 alias están añadidos y
 *    verificados (ya están según la captura del usuario):
 *      • presupuestos@pauinteriorismo.es
 *      • administracion@pauinteriorismo.es
 *      • info@pauinteriorismo.es
 *    (El alias "POP" no se puede usar como `from` desde GmailApp; estos sí.)
 *
 *  PERMISOS QUE PEDIRÁ EL APPS SCRIPT al re-desplegar:
 *      • Enviar email en tu nombre (gmail.send / gmail.compose)
 *      • Acceso a tus alias enviar-como
 *
 *  CUOTA DIARIA: 1500 emails/día con cuenta Workspace, 100/día con @gmail.com.
 *  La cuenta pauinteriorismo@gmail.com es gratuita → 100/día. Más que suficiente.
 *
 *  PAYLOAD que envía el frontend (POST text/plain):
 *    {
 *      action: 'sendEmail',
 *      from:    'presupuestos@pauinteriorismo.es' | ... ,
 *      to:      'cliente@example.com',
 *      cc:      'cc1@x.com, cc2@x.com'   // opcional, separado por comas
 *      bcc:     'oculta@x.com',          // opcional
 *      subject: 'Asunto',
 *      htmlBody:'<div>...</div>',
 *      attachments: [                    // opcional
 *        { filename:'doc.pdf', contentBase64:'JVBERi0...', mimeType:'application/pdf' }
 *      ]
 *    }
 *
 *  RESPUESTA OK:    { ok:true,  messageId:'...', sentAs:'...' }
 *  RESPUESTA ERROR: { ok:false, error:'mensaje' }
 *
 * ============================================================================
 */

// === PEGAR DENTRO del switch(action) de doPost(e), junto a 'getSubFolderUrl' ===

case 'sendEmail': {
  try {
    var from    = (data.from    || '').toString().trim();
    var to      = (data.to      || '').toString().trim();
    var cc      = (data.cc      || '').toString().trim();
    var bcc     = (data.bcc     || '').toString().trim();
    var subject = (data.subject || '').toString();
    var htmlBody= (data.htmlBody|| '').toString();
    var atts    = Array.isArray(data.attachments) ? data.attachments : [];

    // Validaciones básicas
    if(!to)      return _jsonOut({ ok:false, error:'Falta destinatario (to)' });
    if(!subject) return _jsonOut({ ok:false, error:'Falta asunto (subject)' });
    if(!htmlBody)return _jsonOut({ ok:false, error:'Falta cuerpo (htmlBody)' });

    // Whitelist de remitentes válidos (debe coincidir con EMAIL_ALIASES del frontend)
    var ALIASES = [
      'presupuestos@pauinteriorismo.es',
      'administracion@pauinteriorismo.es',
      'info@pauinteriorismo.es'
    ];
    if(from && ALIASES.indexOf(from) === -1){
      return _jsonOut({ ok:false, error:'Alias no permitido: '+from });
    }

    // Construir adjuntos como blobs
    var blobs = atts.map(function(a){
      var bytes = Utilities.base64Decode(a.contentBase64 || '');
      return Utilities.newBlob(bytes, a.mimeType || 'application/octet-stream', a.filename || 'adjunto');
    });

    // Opciones de GmailApp.sendEmail
    var opts = {
      htmlBody: htmlBody,
      name:    'Pau Interiorismo',
      replyTo: from || undefined,
      from:    from || undefined   // Requiere que el alias esté configurado en "Enviar como"
    };
    if(cc)  opts.cc  = cc;
    if(bcc) opts.bcc = bcc;
    if(blobs.length) opts.attachments = blobs;

    GmailApp.sendEmail(to, subject, '', opts);

    return _jsonOut({ ok:true, sentAs: from || Session.getActiveUser().getEmail() });
  } catch(err) {
    return _jsonOut({ ok:false, error: String(err && err.message || err) });
  }
}


// === HELPER: si _jsonOut no existe ya en tu Apps Script, añade esta función. ===
//   (Si ya tienes una función equivalente para devolver JSON, ignora esto.)

function _jsonOut(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================================
 *  PASOS PARA DESPLEGAR
 * ============================================================================
 *
 *  1. Abre el Apps Script de Drive (el mismo de DRIVE_SCRIPT_URL).
 *  2. Pega el bloque `case 'sendEmail': { ... }` dentro del switch de doPost.
 *  3. Añade `_jsonOut` si no existe ya.
 *  4. Guarda (Ctrl+S).
 *  5. Implementar → Gestionar implementaciones → editar la implementación
 *     existente → Versión "Nueva versión" → Implementar.
 *     (NO crees una implementación nueva: la URL DRIVE_SCRIPT_URL del index.html
 *     debe seguir siendo la misma.)
 *  6. La primera vez que se ejecute pedirá permisos extra (gmail.send).
 *     Acepta con la cuenta pauinteriorismo@gmail.com.
 *  7. Listo: prueba enviar un email desde la app.
 *
 * ============================================================================
 *  TEST RÁPIDO desde el editor de Apps Script
 * ============================================================================
 *
 *  Crea esta función temporal y ejecútala una vez para confirmar permisos
 *  y verificar que los 3 alias funcionan:
 *
 *    function testSendEmail(){
 *      GmailApp.sendEmail(
 *        'tu-email-de-prueba@gmail.com',
 *        'Prueba alias presupuestos',
 *        '',
 *        { htmlBody:'<b>Hola</b> desde Apps Script',
 *          from:    'presupuestos@pauinteriorismo.es',
 *          name:    'Pau Interiorismo',
 *          replyTo: 'presupuestos@pauinteriorismo.es' }
 *      );
 *    }
 *
 *  Si recibes el email con remitente "presupuestos@..." → todo OK.
 *  Si llega como "pauinteriorismo@gmail.com" → falta configurar el alias en
 *  Gmail → Configuración → Cuentas e importación → Enviar como.
 *
 * ============================================================================
 */

import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { ImapFlow } from 'imapflow';

const SMTP_HOST = process.env.VADAVO_SMTP_HOST || 'correo01.vadavo.com';
const SMTP_PORT = parseInt(process.env.VADAVO_SMTP_PORT || '465', 10);
const IMAP_HOST = process.env.VADAVO_IMAP_HOST || 'correo01.vadavo.com';
const IMAP_PORT = parseInt(process.env.VADAVO_IMAP_PORT || '993', 10);

const PASSWORDS = {
  'presupuestos@pauinteriorismo.es':   process.env.VADAVO_PASS_PRESUPUESTOS,
  'administracion@pauinteriorismo.es': process.env.VADAVO_PASS_ADMINISTRACION,
  'info@pauinteriorismo.es':           process.env.VADAVO_PASS_INFO
};

const SENT_FOLDERS = ['Sent', 'INBOX.Sent', 'Enviados', 'INBOX.Enviados', 'INBOX/Sent'];

function buildRaw(mailOptions){
  return new Promise((resolve, reject) => {
    new MailComposer(mailOptions).compile().build((err, msg) => {
      if(err) return reject(err);
      resolve(msg);
    });
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok:false, error:'Método no permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { from, to, cc, bcc, subject, htmlBody, textBody, attachments } = body;
    if (!from || !to || !subject) {
      return res.status(400).json({ ok:false, error:'Faltan campos obligatorios (from/to/subject)' });
    }
    const pass = PASSWORDS[from];
    if (!pass) {
      return res.status(400).json({ ok:false, error:`Sin contraseña configurada en Vercel para ${from}. Añade VADAVO_PASS_* a las env vars.` });
    }

    const mailAttachments = Array.isArray(attachments) ? attachments.map(a => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64 || '', 'base64'),
      contentType: a.mimeType || 'application/octet-stream'
    })) : [];

    const mailOptions = {
      from,
      to,
      cc:  cc  || undefined,
      bcc: bcc || undefined,
      subject,
      html: htmlBody || undefined,
      text: textBody || undefined,
      attachments: mailAttachments
    };

    // 1) Enviar por SMTP
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: from, pass },
      tls: { rejectUnauthorized: false }
    });
    const sendInfo = await transporter.sendMail(mailOptions);

    // 2) Construir el raw MIME y guardar copia en Enviados vía IMAP APPEND
    let appendedFolder = null;
    let appendError   = null;
    try {
      const rawBuffer = await buildRaw(mailOptions);
      const imap = new ImapFlow({
        host: IMAP_HOST,
        port: IMAP_PORT,
        secure: IMAP_PORT === 993,
        auth: { user: from, pass },
        logger: false,
        tls: { rejectUnauthorized: false }
      });
      await imap.connect();
      // Buscar la carpeta Sent real entre las candidatas (y por SPECIAL-USE \Sent si existe)
      try {
        const list = await imap.list();
        const specialSent = list.find(m => Array.isArray(m.specialUse) ? m.specialUse.includes('\\Sent') : m.specialUse === '\\Sent');
        const candidates = specialSent ? [specialSent.path, ...SENT_FOLDERS] : SENT_FOLDERS.slice();
        for (const folder of candidates) {
          try {
            await imap.append(folder, rawBuffer, ['\\Seen']);
            appendedFolder = folder;
            break;
          } catch (_) { /* probar siguiente */ }
        }
      } finally {
        try { await imap.logout(); } catch(_){}
      }
      if (!appendedFolder) appendError = 'No se encontró carpeta de Enviados';
    } catch (e) {
      appendError = e.message;
    }

    return res.status(200).json({
      ok: true,
      messageId: sendInfo.messageId,
      sentFolder: appendedFolder,
      appendError
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}

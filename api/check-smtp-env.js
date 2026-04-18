// Endpoint de diagnóstico: comprueba cómo están configuradas las env vars
// de contraseñas SMTP/IMAP en Vercel, SIN revelar el contenido.
// Útil para detectar espacios/saltos de línea pegados al copiar la contraseña.
//
// Uso: abrir en el navegador https://<tu-dominio>/api/check-smtp-env
//
// Devuelve, por cada alias:
// - set: true/false (si la env var existe y no está vacía)
// - length: número de caracteres
// - trimmedLength: número de caracteres tras quitar espacios al inicio/final
// - hasLeadingSpace / hasTrailingSpace: true si hay espacios al inicio/final
// - hasNewline: true si hay salto de línea en medio (error común al pegar)
// - firstChar / lastChar: solo devuelve si es un carácter "sospechoso"
//   (espacio, tab, nueva línea) o " (no tu letra real, por privacidad).
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const aliases = {
    'VADAVO_PASS_PRESUPUESTOS':   process.env.VADAVO_PASS_PRESUPUESTOS,
    'VADAVO_PASS_ADMINISTRACION': process.env.VADAVO_PASS_ADMINISTRACION,
    'VADAVO_PASS_INFO':           process.env.VADAVO_PASS_INFO
  };
  const out = {};
  for (const [name, raw] of Object.entries(aliases)) {
    if (raw == null || raw === '') {
      out[name] = { set: false };
      continue;
    }
    const trimmed = raw.trim();
    const hasLeadingSpace  = raw !== raw.replace(/^[\s]+/, '');
    const hasTrailingSpace = raw !== raw.replace(/[\s]+$/, '');
    const hasNewline       = /[\r\n]/.test(raw);
    // Solo expongo primer/último carácter si son sospechosos, para no filtrar contraseña.
    const suspicious = /[\s\r\n\t]/;
    out[name] = {
      set: true,
      length: raw.length,
      trimmedLength: trimmed.length,
      hasLeadingSpace,
      hasTrailingSpace,
      hasNewline,
      firstCharSuspicious: suspicious.test(raw.charAt(0)),
      lastCharSuspicious:  suspicious.test(raw.charAt(raw.length - 1))
    };
  }
  // Host/puerto también para confirmar
  out.hosts = {
    VADAVO_SMTP_HOST: process.env.VADAVO_SMTP_HOST || '(default) correo01.vadavo.com',
    VADAVO_SMTP_PORT: process.env.VADAVO_SMTP_PORT || '(default) 465',
    VADAVO_IMAP_HOST: process.env.VADAVO_IMAP_HOST || '(default) correo01.vadavo.com',
    VADAVO_IMAP_PORT: process.env.VADAVO_IMAP_PORT || '(default) 993'
  };
  return res.status(200).json(out);
}

#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Importador genérico de catálogos Excel → Supabase
// Uso: node scripts/import_catalogo.js <ruta_excel> <fabricante> [hoja]
//
// Ejemplo TOBISA:
//   node scripts/import_catalogo.js "../Tobisa/TOBISA Tarifa Técnica 2.51.2 Excel.xlsx" TOBISA "TOBISA Tarifa 2.51"
//
// Columnas esperadas (fila 2 = cabeceras, o auto-detect):
//   REFERENCIA | DESCRIPCIÓN | H | L | P | BASE (€) | COLOR (€) | PÁGINA PDF | OTRAS PÁG.
// ═══════════════════════════════════════════════════════════════

const XLSX = require('xlsx');

const SB_URL = 'https://qxyflndntpmcdbyvwjnj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eWZsbmRudHBtY2RieXZ3am5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjgzOTMsImV4cCI6MjA4NzUwNDM5M30.WQ193I6oS9ANMvuWG8XXa_J6oFleoTSlLQKeFVR_d50';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Uso: node import_catalogo.js <ruta_excel> <fabricante> [nombre_hoja]');
  console.log('Ejemplo: node import_catalogo.js "../Tobisa/TOBISA Tarifa Técnica 2.51.2 Excel.xlsx" TOBISA "TOBISA Tarifa 2.51"');
  process.exit(1);
}

const [excelPath, fabricante, sheetName] = args;

// ── Leer Excel ──────────────────────────────────────────────
console.log(`\n📂 Leyendo: ${excelPath}`);
const wb = XLSX.readFile(excelPath);
const wsName = sheetName || wb.SheetNames.find(s => s !== 'Leer esto') || wb.SheetNames[0];
console.log(`📋 Hoja: ${wsName}`);
const ws = wb.Sheets[wsName];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

// ── Detectar fila de cabeceras ──────────────────────────────
let headerRow = -1;
for (let i = 0; i < Math.min(10, raw.length); i++) {
  const row = raw[i];
  if (row && row.some(c => typeof c === 'string' && /REFERENCIA/i.test(c))) {
    headerRow = i;
    break;
  }
}
if (headerRow < 0) { console.error('❌ No se encontró fila de cabeceras con REFERENCIA'); process.exit(1); }

const headers = raw[headerRow].map(h => String(h || '').trim().toUpperCase());
console.log(`📌 Cabeceras (fila ${headerRow}): ${headers.join(' | ')}`);

// Mapear columnas
const colMap = {
  ref:    headers.findIndex(h => /REFERENCIA/i.test(h)),
  desc:   headers.findIndex(h => /DESCRIPCI/i.test(h)),
  alto:   headers.findIndex(h => /^H$/i.test(h)),
  ancho:  headers.findIndex(h => /^L$/i.test(h)),
  fondo:  headers.findIndex(h => /^P$/i.test(h)),
  base:   headers.findIndex(h => /BASE/i.test(h)),
  color:  headers.findIndex(h => /COLOR/i.test(h)),
  pagina: headers.findIndex(h => /P.GINA/i.test(h)),
  otras:  headers.findIndex(h => /OTRAS/i.test(h)),
};
console.log('🗂️  Mapa columnas:', colMap);

// ── Parsear filas ───────────────────────────────────────────
const productos = [];
for (let i = headerRow + 1; i < raw.length; i++) {
  const r = raw[i];
  if (!r || !r[colMap.ref]) continue; // Saltar filas sin referencia

  const ref = String(r[colMap.ref]).trim();
  if (!ref) continue;

  const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  // Dimensiones: mm → cm (dividir entre 10)
  const mmToCm = (v) => { const n = toNum(v); return n !== null ? Math.round(n / 10 * 10) / 10 : null; };

  productos.push({
    fabricante,
    ref,
    descripcion: r[colMap.desc] ? String(r[colMap.desc]).trim() : null,
    alto:        mmToCm(r[colMap.alto]),
    ancho:       mmToCm(r[colMap.ancho]),
    fondo:       mmToCm(r[colMap.fondo]),
    precio_base: toNum(r[colMap.base]),
    precio_color: toNum(r[colMap.color]),
    pagina_pdf:  r[colMap.pagina] ? parseInt(r[colMap.pagina]) || null : null,
    otras_pag:   r[colMap.otras] ? String(r[colMap.otras]).trim() : null,
  });
}

console.log(`\n✅ ${productos.length} productos parseados`);
console.log(`   Con precio_base: ${productos.filter(p => p.precio_base !== null).length}`);
console.log(`   Con precio_color: ${productos.filter(p => p.precio_color !== null).length}`);
console.log(`   Ejemplo: ${JSON.stringify(productos[0])}`);

// ── Upsert en Supabase (lotes de 500) ──────────────────────
async function upsert(batch) {
  const res = await fetch(`${SB_URL}/rest/v1/catalogo_productos`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(batch)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
}

async function main() {
  const BATCH = 500;
  let ok = 0, errors = 0;

  // Primero borrar productos antiguos de este fabricante
  console.log(`\n🗑️  Limpiando registros anteriores de ${fabricante}...`);
  const delRes = await fetch(`${SB_URL}/rest/v1/catalogo_productos?fabricante=eq.${encodeURIComponent(fabricante)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
    }
  });
  if (delRes.ok) console.log('   Registros anteriores eliminados');

  console.log(`\n📤 Subiendo ${productos.length} productos en lotes de ${BATCH}...`);
  for (let i = 0; i < productos.length; i += BATCH) {
    const batch = productos.slice(i, i + BATCH);
    try {
      await upsert(batch);
      ok += batch.length;
      process.stdout.write(`   ${ok}/${productos.length} ✅\r`);
    } catch (e) {
      console.error(`\n❌ Error lote ${i}-${i + batch.length}: ${e.message}`);
      errors += batch.length;
    }
  }

  console.log(`\n\n═══════════════════════════════════`);
  console.log(`✅ Importación completada`);
  console.log(`   Fabricante: ${fabricante}`);
  console.log(`   Insertados: ${ok}`);
  console.log(`   Errores:    ${errors}`);
  console.log(`═══════════════════════════════════\n`);
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });

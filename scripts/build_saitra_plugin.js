// Genera el "var D = {...}" del plugin Saitra leyendo SAITRA_MOD de index.html.
// Reemplaza el bloque en saitra_cocinas.rb y mantiene el resto del plugin intacto.
// Uso: node scripts/build_saitra_plugin.js

const fs = require('fs');
const path = require('path');

const HTML = 'C:/Users/Usuario/Desktop/Pau Interiorismo/Administracion/Control proyectos/Aplicacion/Html/index.html';
const RB   = 'C:/Users/Usuario/AppData/Roaming/SketchUp/SketchUp 2022/SketchUp/Plugins/saitra_pau/saitra_cocinas.rb';

const html = fs.readFileSync(HTML, 'utf8');

// ══════════════════════════════════════════════
// 1) Extraer SAITRA_MOD del index.html
// ══════════════════════════════════════════════
const i0 = html.indexOf('const SAITRA_MOD = {');
if (i0 === -1) { console.error('✗ No se encontró SAITRA_MOD'); process.exit(1); }
// Buscar el cierre: primera línea que sea "};" en columna 0 después del inicio
let depth = 0, i = i0;
let end = -1;
while (i < html.length) {
  const ch = html[i];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  i++;
}
if (end === -1) { console.error('✗ Cierre de SAITRA_MOD no encontrado'); process.exit(1); }

const modBlock = html.slice(i0, end); // "const SAITRA_MOD = {...}"
console.log('Bloque SAITRA_MOD leído:', modBlock.length, 'chars');

// Evaluar en sandbox
let SAITRA_MOD;
try {
  const fn = new Function(modBlock + '; return SAITRA_MOD;');
  SAITRA_MOD = fn();
} catch (e) {
  console.error('✗ Error evaluando SAITRA_MOD:', e.message);
  process.exit(1);
}

const refsKeys = Object.keys(SAITRA_MOD);
console.log('Refs en SAITRA_MOD:', refsKeys.length);

// ══════════════════════════════════════════════
// 2) Agrupar por "grupo" → asignar a una de las 5 pestañas
// ══════════════════════════════════════════════
const tabRules = [
  // [tabKey, test(grupo)]
  ['b',   g => /^BASES(?! GOLA)(?! DOBLE GOLA)/i.test(g)],
  ['g',   g => /^BASES (GOLA|DOBLE GOLA)/i.test(g)],
  ['c',   g => /^COLGANTES/i.test(g)],
  ['col', g => /^(COLUMNAS|SOBRECOLUMNAS)/i.test(g)],
  // Los INCREMENTOS no se insertan como dibujo — se excluyen
];

function tabFor(grupo) {
  for (const [k, test] of tabRules) if (test(grupo || '')) return k;
  return null; // refs que no matchean (incrementos, etc.) se ignoran
}

// Estructura: tabs[tabKey] = [{grupo, items:[{ref,label,widths}]}, ...]
const tabs = { b:[], g:[], c:[], col:[] };
const groupMap = {}; // por nombre de grupo → entry

refsKeys.forEach(ref => {
  const m = SAITRA_MOD[ref];
  if (!m || !m.grupo) return;
  const grupo = m.grupo;
  const anchosObj = m.anchos || {};
  // Extraer anchos numéricos (ignorar claves especiales como "39x45")
  const widths = Object.keys(anchosObj)
    .filter(k => /^\d+$/.test(k))
    .map(k => parseInt(k))
    .sort((a,b) => a-b);
  if (!widths.length) return; // saltamos refs sin anchos numéricos (accesorios)

  const tabKey = tabFor(grupo);
  if (!tabKey) return;
  if (!groupMap[grupo]) {
    const entry = { grupo, items: [] };
    groupMap[grupo] = entry;
    tabs[tabKey].push(entry);
  }
  groupMap[grupo].items.push({
    ref,
    label: (m.label || ref).replace(/"/g, '\\"'),
    widths
  });
});

// Reporte
console.log('\n═══ DISTRIBUCIÓN ═══');
Object.keys(tabs).forEach(k => {
  const total = tabs[k].reduce((a,g)=>a+g.items.length, 0);
  console.log(`  ${k.toUpperCase().padEnd(4)} · ${tabs[k].length} grupos, ${total} refs`);
});

// ══════════════════════════════════════════════
// 3) Generar el bloque var D
// ══════════════════════════════════════════════
const tabMeta = {
  b:   { lbl: 'Bases',        clr: '#c0392b' },
  g:   { lbl: 'Bases Gola',   clr: '#d35400' },
  c:   { lbl: 'Colgantes',    clr: '#2980b9' },
  col: { lbl: 'Columnas',     clr: '#27ae60' },
};

// Tab "e" (Especiales) se mantiene hardcoded — los costados, regletas y zócalos
// no viven en SAITRA_MOD (están en SAITRA_ZOC / SAITRA_ACC / SAITRA_GOLA),
// y su lógica de dibujo usa keys especiales (fixh, freeh). Lo dejamos tal cual.
const especialesHardcoded = `e:{lbl:"Especiales",clr:"#8e44ad",ti:[
    {t:"Zocalo H.10", r:[["ZOC","Zocalo H.10"]], a:[30,40,50,60,70,80,90,100,150,200,250,300], fixh:10},
    {t:"Regleta (R)", r:[["R","Regleta"]], a:[30,40,50,60,70,80,90,100,150,200,250], freeh:true},
    {t:"Costado (C)", r:[["C","Costado"]], a:[60,62,67], freeh:true}
  ]}`;

function extractH(str) {
  // "BASES H.78 F.60" → 78 · "COLGANTES H.91" → 91 · "Sobrecolumna 1P H.39/F.60" → 39
  const m = (str || '').match(/H\.?(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function makeTabJS(tabKey) {
  const meta = tabMeta[tabKey];
  // Aplanar todos los items en array de tipos {t, g, r, a, h}
  // h = altura por defecto (cm) extraída del nombre del grupo
  const tipos = [];
  tabs[tabKey].forEach(grp => {
    const grpH = extractH(grp.grupo);
    grp.items.forEach(it => {
      const obj = {
        t: it.label,
        g: grp.grupo,
        r: [[it.ref, it.label]],
        a: it.widths
      };
      // Prioridad: H del grupo → H del label → nada
      const h = grpH || extractH(it.label);
      if (h) obj.h = h;
      tipos.push(obj);
    });
  });
  const tiJS = tipos.map(ti => {
    const rJS = ti.r.map(([ref, lbl]) => `["${ref}","${lbl}"]`).join(',');
    const aJS = ti.a.join(',');
    const hPart = ti.h ? `,h:${ti.h}` : '';
    return `{t:"${ti.t}",g:"${ti.g}",r:[${rJS}],a:[${aJS}]${hPart}}`;
  }).join(',\n    ');
  return `${tabKey}:{lbl:"${meta.lbl}",clr:"${meta.clr}",ti:[\n    ${tiJS}\n  ]}`;
}

const generated = ['b','g','c','col'].map(makeTabJS).join(',\n  ');
const varD = `var D = {\n  ${generated},\n  ${especialesHardcoded}\n};`;

// ══════════════════════════════════════════════
// 4) Reemplazar var D en el .rb
// ══════════════════════════════════════════════
let rb = fs.readFileSync(RB, 'utf8');
// Buscar "var D = {" y cierre balanceado
const vdStart = rb.indexOf('var D = {');
if (vdStart === -1) { console.error('✗ var D no encontrado en saitra_cocinas.rb'); process.exit(1); }
let d = 0, j = vdStart + 'var D = '.length, vdEnd = -1;
while (j < rb.length) {
  const ch = rb[j];
  if (ch === '{') d++;
  else if (ch === '}') { d--; if (d === 0) {
    // Expect ";" after
    const k = rb.indexOf(';', j);
    vdEnd = k + 1;
    break;
  }}
  j++;
}
if (vdEnd === -1) { console.error('✗ Cierre de var D no encontrado'); process.exit(1); }

const before = rb.slice(0, vdStart);
const after  = rb.slice(vdEnd);
const newRb  = before + varD + after;

fs.writeFileSync(RB, newRb);
console.log('\n✅ Plugin Saitra actualizado:', RB);
console.log('   Tamaño:', (newRb.length/1024).toFixed(1), 'KB');
const totalRefs = Object.values(tabs).reduce((a,arr)=>a+arr.reduce((b,g)=>b+g.items.length,0), 0);
console.log('   Refs embebidas:', totalRefs);

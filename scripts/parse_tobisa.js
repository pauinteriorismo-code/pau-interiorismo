// Genera el bloque "var D = {...}" para el plugin SketchUp Tobisa
// con las refs REALES de la tarifa técnica 2.51.2
const XLSX = require('xlsx');
const fs = require('fs');

const file = 'C:/Users/Usuario/Desktop/Pau Interiorismo/Administracion/Control proyectos/Aplicacion/Tobisa/Catalogos/TOBISA Tarifa Técnica 2.51.2 Excel.xlsx';
const wb = XLSX.readFile(file);
const sh = wb.Sheets['TOBISA Tarifa 2.51'];
const rows = XLSX.utils.sheet_to_json(sh, {header:1, defval:''});

// Normalización unidades → cm (algunas filas vienen en mm, otras ya en cm)
function toCm(h, l, p) {
  const maxV = Math.max(h||0, l||0, p||0);
  const f = (maxV > 300) ? 0.1 : 1;
  return { h: Math.round((h||0)*f), l: Math.round((l||0)*f), p: Math.round((p||0)*f) };
}

const refs = rows
  .filter(r => /^D\d{4}$/.test(String(r[0]).trim()))
  .map(r => {
    const { h, l, p } = toCm(parseFloat(r[2])||0, parseFloat(r[3])||0, parseFloat(r[4])||0);
    return {
      ref: String(r[0]).trim(),
      desc: String(r[1]||'').trim(),
      h, l, p,
    };
  });

// Patrones ESTRICTOS — sólo módulos puros (no combos)
const tipos = [
  // sub, label, regex exacto
  ['caj1',  '1 cajón',        /^M[OÓ]DULO 1 CAJ[OÓ]N$/i],
  ['caj2',  '2 cajones',      /^M[OÓ]DULO 2 CAJONES$/i],
  ['caj3',  '3 cajones',      /^M[OÓ]DULO 3 CAJONES$/i],
  ['caj4',  '4 cajones',      /^M[OÓ]DULO 4 CAJONES$/i],
  ['caj5',  '5 cajones',      /^M[OÓ]DULO 5 CAJONES$/i],
  ['caj6',  '6 cajones',      /^M[OÓ]DULO 6 CAJONES$/i],
  ['cont1', '1 contenedor',   /^M[OÓ]DULO 1 CONTENEDOR$/i],
  ['cont2', '2 contenedores', /^M[OÓ]DULO 2 CONTENEDORES$/i],
  ['cont3', '3 contenedores', /^M[OÓ]DULO 3 CONTENEDORES$/i],
  ['cont4', '4 contenedores', /^M[OÓ]DULO 4 CONTENEDORES$/i],
  ['diaf',  'Diáfano',        /^M[OÓ]DULO DI[AÁ]FANO$/i],
  ['pta_izq','1 puerta izq.', /^M[OÓ]DULO 1 PUERTA IZQUIERDA$/i],
  ['pta_der','1 puerta dcha.',/^M[OÓ]DULO 1 PUERTA DERECHA$/i],
  ['pta_dd', '1 pta. dcha/izq',/^M[OÓ]DULO 1 PUERTA DERECHA\/IZQUIERDA$/i],
  ['pta2',  '2 puertas',      /^M[OÓ]DULO 2 PUERTAS$/i],
  // Combos puerta+cajón (varias variantes comunes)
  ['cc',    '1 caj + 1 cont', /^M[OÓ]DULO 1 CAJ[OÓ]N 1 CONTENEDOR$/i],
  ['cc2',   '1 caj + 2 cont', /^M[OÓ]DULO 1 CAJ[OÓ]N 2 CONTENEDORES$/i],
  ['cc3',   '2 caj + 1 cont', /^M[OÓ]DULO 2 CAJONES 1 CONTENEDOR$/i],
  ['cc4',   '3 caj + 1 cont', /^M[OÓ]DULO 3 CAJONES 1 CONTENEDOR$/i],
  ['cp',    '1 caj + 1 pta',  /^M[OÓ]DULO 1 CAJ[OÓ]N 1 PUERTA/i],
];

function grupo(regex) {
  return refs.filter(r => regex.test(r.desc))
    .sort((a,b) => a.h - b.h || a.l - b.l);
}

// Módulos
const modData = tipos.map(([sub, label, re]) => ({sub, label, items: grupo(re)}));

// Escritorios
const escData = [
  ['escr', 'Escritorios', /^ESCRITORIO/i],
  ['enci', 'Encimeras',   /^ENCIMERA/i],
  ['porter','Porter',     /^PORTER/i],
].map(([sub,label,re]) => ({sub, label, items: grupo(re)}));

// Estanterías
const estData = [
  ['estm',  'Estantes módulos',  /^ESTANTE MODULOS/i],
  ['estp',  'Estante prenda',    /^ESTANTE .*(PRENDA|PRENDAS)/i],
  ['estger','Estantes generales',/^ESTANTE(?! MODULOS)(?! .*PRENDA)/i],
  ['esttot','Estanterías',       /^ESTANTER[IÍ]A/i],
  ['cubo',  'Cubos',             /^CUBO /i],
].map(([sub,label,re]) => ({sub, label, items: grupo(re)}));

// Camas
const camData = [
  ['camsing','Cama singular',     /^CAMA SINGULAR/i],
  ['camab',  'Cama abatible',     /^CAMA ABATIBLE|^CAMA MIXTA ESCAMOTE/i],
  ['camnid', 'Cama nido',         /^CAMA NIDO/i],
  ['cambase','Cama base',         /^CAMA BASE|^CAMA CON BASE/i],
  ['cam_otros','Otras camas',     /^CAMA /i],
  ['litera', 'Literas',           /^LITERA/i],
  ['nido',   'Nidos',             /^NIDO/i],
  ['bastidor','Bastidores/somier',/^BASTIDOR|^SOMIER/i],
].map(([sub,label,re]) => ({sub, label, items: grupo(re)}));

// Eliminar duplicados entre grupos (el primer match gana)
function dedup(tabData) {
  const seen = new Set();
  return tabData.map(t => ({
    ...t,
    items: t.items.filter(i => {
      if(seen.has(i.ref)) return false;
      seen.add(i.ref);
      return true;
    })
  })).filter(t => t.items.length);
}

const finalMod = dedup(modData);
const finalEsc = dedup(escData);
const finalEst = dedup(estData);
const finalCam = dedup(camData);

// Reporte
console.log('RESUMEN FINAL:');
console.log('\n─ MÓDULOS ─');
finalMod.forEach(t => console.log('  ', t.sub.padEnd(10), t.label.padEnd(22), t.items.length, 'refs'));
console.log('\n─ ESCRITORIOS ─');
finalEsc.forEach(t => console.log('  ', t.sub.padEnd(10), t.label.padEnd(22), t.items.length, 'refs'));
console.log('\n─ ESTANTERÍAS ─');
finalEst.forEach(t => console.log('  ', t.sub.padEnd(10), t.label.padEnd(22), t.items.length, 'refs'));
console.log('\n─ CAMAS ─');
finalCam.forEach(t => console.log('  ', t.sub.padEnd(10), t.label.padEnd(22), t.items.length, 'refs'));

const total = [finalMod,finalEsc,finalEst,finalCam]
  .flat().reduce((a,t)=>a+t.items.length,0);
console.log('\nTotal refs en plugin:', total);

// Generar JS compacto para inyectar en el plugin Ruby
function toJS(tabData) {
  return tabData.map(t => {
    const items = t.items.map(i =>
      `{r:"${i.ref}",d:"${i.desc.replace(/"/g,'').replace(/\s+/g,' ').slice(0,50)}",h:${i.h},l:${i.l}}`
    ).join(',');
    return `{t:"${t.label}",sub:"${t.sub}",refs:[${items}]}`;
  }).join(',\n    ');
}

const jsBlock =
`var D = {
  mod:{lbl:"Módulos Tobisa",clr:"#6a1b9a",ti:[
    ${toJS(finalMod)}
  ]},
  esc:{lbl:"Escritorios Tobisa",clr:"#0d47a1",ti:[
    ${toJS(finalEsc)}
  ]},
  est:{lbl:"Estanterías Tobisa",clr:"#2e7d32",ti:[
    ${toJS(finalEst)}
  ]},
  cam:{lbl:"Camas Tobisa",clr:"#b71c1c",ti:[
    ${toJS(finalCam)}
  ]}
};`;

fs.writeFileSync(
  'C:/Users/Usuario/Desktop/Pau Interiorismo/Administracion/Control proyectos/Aplicacion/Html/scripts/tobisa_plugin_data.js',
  jsBlock
);
console.log('\n→ Escrito tobisa_plugin_data.js (', jsBlock.length, 'chars )');

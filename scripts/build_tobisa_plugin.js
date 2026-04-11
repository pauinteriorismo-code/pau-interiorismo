// Genera tobisa_cocinas.rb a partir de la tarifa técnica 2.51.2
// - Las 2961 refs completas, distribuidas en 6 pestañas
// - UI con edit H/L/P antes de insertar
// - Etiqueta dentro del componente (se selecciona con el dibujo)
// Uso: node scripts/build_tobisa_plugin.js

const XLSX = require('xlsx');
const fs = require('fs');

const file = 'C:/Users/Usuario/Desktop/Pau Interiorismo/Administracion/Control proyectos/Aplicacion/Tobisa/Catalogos/TOBISA Tarifa Técnica 2.51.2 Excel.xlsx';
const wb = XLSX.readFile(file);
const sh = wb.Sheets['TOBISA Tarifa 2.51'];
const rows = XLSX.utils.sheet_to_json(sh, {header:1, defval:''});

// La tarifa mezcla mm y cm: si max(H,L,P) > 300 → mm, else cm
function toCm(h, l, p) {
  const maxV = Math.max(h||0, l||0, p||0);
  const f = (maxV > 300) ? 0.1 : 1;
  return { h: Math.round((h||0)*f), l: Math.round((l||0)*f), p: Math.round((p||0)*f) };
}

const refs = rows
  .filter(r => /^D\d{4}$/.test(String(r[0]).trim()))
  .map(r => {
    const { h, l, p } = toCm(parseFloat(r[2])||0, parseFloat(r[3])||0, parseFloat(r[4])||0);
    const desc = String(r[1]||'').trim().replace(/["\\\r\n]/g,' ').replace(/\s+/g,' ');
    return { ref: String(r[0]).trim(), desc, h, l, p };
  });

console.log('Total refs:', refs.length);

// ══════════════════════════════════════════════════════════
// Configuración de pestañas. Orden = prioridad (primera en matchear gana).
// Cada sub tiene: [clave_js, label_ui, regex_específico, sub_para_dibujar]
// El último sub de cada pestaña suele ser un "otros" con regex amplio.
// ══════════════════════════════════════════════════════════

const tabsConfig = {
  mod: {
    label: 'Módulos', color: '#6a1b9a',
    subs: [
      ['caj1',   '1 cajón',             /^M[OÓ]DULO 1 CAJ[OÓ]N$/i,                            'caj1'],
      ['caj2',   '2 cajones',           /^M[OÓ]DULO 2 CAJONES$/i,                             'caj2'],
      ['caj3',   '3 cajones',           /^M[OÓ]DULO 3 CAJONES$/i,                             'caj3'],
      ['caj4',   '4 cajones',           /^M[OÓ]DULO 4 CAJONES$/i,                             'caj4'],
      ['caj5',   '5 cajones',           /^M[OÓ]DULO 5 CAJONES$/i,                             'caj5'],
      ['caj6',   '6 cajones',           /^M[OÓ]DULO 6 CAJONES$/i,                             'caj6'],
      ['cont1',  '1 contenedor',        /^M[OÓ]DULO 1 CONTENEDOR$/i,                          'cont1'],
      ['cont2',  '2 contenedores',      /^M[OÓ]DULO 2 CONTENEDORES$/i,                        'cont2'],
      ['cont3',  '3 contenedores',      /^M[OÓ]DULO 3 CONTENEDORES$/i,                        'cont3'],
      ['cont4',  '4 contenedores',      /^M[OÓ]DULO 4 CONTENEDORES$/i,                        'cont4'],
      ['diaf',   'Diáfano',             /^M[OÓ]DULO DI[AÁ]FANO$/i,                            'diaf'],
      ['pta_izq','1 puerta izquierda',  /^M[OÓ]DULO 1 PUERTA IZQUIERDA$/i,                    'pta_izq'],
      ['pta_der','1 puerta derecha',    /^M[OÓ]DULO 1 PUERTA DERECHA$/i,                      'pta_der'],
      ['pta_dd', '1 puerta (I/D)',      /^M[OÓ]DULO 1 PUERTA DERECHA\/IZQUIERDA$/i,           'pta_dd'],
      ['pta2',   '2 puertas',           /^M[OÓ]DULO 2 PUERTAS$/i,                             'pta2'],
      ['cc',     '1 caj + 1 contenedor',/^M[OÓ]DULO 1 CAJ[OÓ]N 1 CONTENEDOR$/i,               'cc'],
      ['cc2',    '1 caj + 2 contenedores',/^M[OÓ]DULO 1 CAJ[OÓ]N 2 CONTENEDORES$/i,           'cc2'],
      ['cc3',    '2 caj + 1 contenedor',/^M[OÓ]DULO 2 CAJONES 1 CONTENEDOR$/i,                'cc3'],
      ['cc4',    '3 caj + 1 contenedor',/^M[OÓ]DULO 3 CAJONES 1 CONTENEDOR$/i,                'cc4'],
      ['cp_izq', '1 caj + 1 pta izq.',  /^M[OÓ]DULO 1 CAJ[OÓ]N 1 PUERTA IZQUIERDA/i,          'cp'],
      ['cp_der', '1 caj + 1 pta dcha.', /^M[OÓ]DULO 1 CAJ[OÓ]N 1 PUERTA DERECHA/i,            'cp'],
      ['cp_2p',  '1 caj + 2 ptas',      /^M[OÓ]DULO 1 CAJ[OÓ]N 2 PUERTAS/i,                   'cp'],
      ['mod_otros','Otros módulos',     /^M[OÓ]DULO /i,                                       'gen'],
      ['caja_puente','Cajas puente',    /^CAJA PUENTE/i,                                      'gen'],
      ['caja',   'Cajas',                /^CAJA /i,                                            'gen'],
      ['mesaux', 'Mesas auxiliares',    /^MESA AUXILIAR/i,                                    'gen'],
      ['patas',  'Juego de patas',      /^JUEGO DE PATAS/i,                                   'gen'],
    ]
  },
  esc: {
    label: 'Escritorios', color: '#0d47a1',
    subs: [
      ['escr',  'Escritorios',  /^ESCRITORIO/i,   'escr'],
      ['enci',  'Encimeras',    /^ENCIMERA/i,     'enci'],
      ['porter','Porter',       /^PORTER/i,       'porter'],
    ]
  },
  est: {
    label: 'Estanterías', color: '#2e7d32',
    subs: [
      ['estm',        'Estantes módulos',    /^ESTANTE MODULOS/i,                    'estm'],
      ['estprenda',   'Estantes prenda',     /^ESTANTE .*PRENDA/i,                   'estm'],
      ['estger',      'Estantes generales',  /^ESTANTE /i,                           'estm'],
      ['esttot',      'Estanterías',         /^ESTANTER[IÍ]A/i,                      'esttot'],
      ['cubo',        'Cubos',               /^CUBO /i,                              'cubo'],
      ['trasera',     'Traseras',            /^TRASERA/i,                            'gen'],
      ['conj',        'Conjuntos',           /^CONJUNTO/i,                           'gen'],
      ['chapa',       'Chapa plegada',       /^CHAPA PLEGADA/i,                      'gen'],
      ['bandejasup',  'Bandeja superior',    /^BANDEJA SUP/i,                        'gen'],
    ]
  },
  cam: {
    label: 'Camas', color: '#b71c1c',
    subs: [
      ['camab',   'Cama abatible',     /^CAMA ABATIBLE|^CAMA MIXTA ESCAMOTE/i,     'camab'],
      ['camnid',  'Cama nido',         /^CAMA NIDO/i,                               'camnid'],
      ['camsing', 'Cama singular',     /^CAMA SINGULAR/i,                           'camsing'],
      ['cambase', 'Cama con base',     /^CAMA BASE|^CAMA CON BASE/i,                'camsing'],
      ['cam_otros','Otras camas',      /^CAMA /i,                                   'cam_otros'],
      ['litera',  'Literas',           /^LITERA/i,                                  'litera'],
      ['nido',    'Nidos',              /^NIDO/i,                                    'camnid'],
      ['bastidor','Bastidores',         /^BASTIDOR|^SOMIER/i,                        'bastidor'],
      ['arcon',   'Arcones',            /^ARC[OÓ]N/i,                                'gen'],
      ['arrim',   'Arrimaderos',        /^ARRIMADERO/i,                              'gen'],
      ['cabec',   'Cabeceros',          /^CABECERO/i,                                'gen'],
      ['panel',   'Paneles',            /^PANEL /i,                                  'gen'],
      ['respaldo','Respaldos',          /^RESPALDO/i,                                'gen'],
      ['liss',    'LISS A M2',          /^LISS/i,                                    'gen'],
      ['barand',  'Barandillas',        /^BARANDILLA/i,                              'gen'],
      ['escalera','Escaleras',          /^ESCALERA/i,                                'gen'],
      ['soporte', 'Soportes',           /^SOPORTE/i,                                 'gen'],
      ['step',    'Step',               /^STEP/i,                                    'gen'],
      ['modtr',   'Módulo TR/Block',    /^M[OÓ]DULO (TR|BLOCK)/i,                    'block'],
      ['block',   'Block',              /^BLOCK/i,                                   'block'],
    ]
  },
  arm: {
    label: 'Armarios', color: '#e65100',
    subs: [
      ['arm_recto', 'Armario recto',      /^ARMARIO RECTO/i,                         'arm'],
      ['arm_rinc',  'Armario rincón',     /^ARMARIO RINC[OÓ]N/i,                     'arm'],
      ['arm',       'Armarios',           /^ARMARIO/i,                               'arm'],
      ['vest',      'Vestidores',         /^VESTIDOR/i,                              'arm'],
      ['pta_arm',   'Puertas armario',    /^PUERTA/i,                                'pta_arm'],
      ['costado',   'Costados',           /^COSTADO/i,                               'gen'],
      ['columna',   'Columnas',           /^COLUMNA/i,                               'gen'],
      ['terminal',  'Terminales',         /^TERMINAL/i,                              'gen'],
      ['bisagra',   'Bisagras',           /^BISAGRA/i,                               'gen'],
      ['barra',     'Barras',             /^BARRA/i,                                 'gen'],
      ['corte',     'Cortes',             /^CORTE/i,                                 'gen'],
      ['cajonera',  'Cajoneras',          /^CAJONERA/i,                              'caj2'],
      ['organiz',   'Organizadores',      /^ORGANIZADOR/i,                           'gen'],
      ['pantal',    'Pantaloneros',       /^PANTALONERO/i,                           'gen'],
      ['zapa',      'Zapateros',          /^ZAPATERO/i,                              'gen'],
      ['cesta',     'Cestas',             /^CESTA/i,                                 'gen'],
      ['espejo',    'Espejos',            /^ESPEJO/i,                                'gen'],
      ['forro',     'Forros',             /^FORRO/i,                                 'gen'],
      ['bandeja',   'Bandejas',           /^BANDEJA/i,                               'gen'],
      ['colgador',  'Colgadores',         /^COLGADOR/i,                              'gen'],
      ['partidor',  'Partidores',         /^PARTIDOR/i,                              'gen'],
      ['est_arm',   'Estantes interiores',/^ESTANTE (ARMARIO|EXTRA|VESTIDOR|INTERIOR)/i,'gen'],
    ]
  },
  otr: {
    label: 'Otros', color: '#546e7a',
    subs: [
      ['zoc',     'Zócalos',            /^Z[OÓ]CALO/i,                               'zoc'],
      ['led',     'Iluminación LED',    /^(LED|TIRA LED)/i,                          'gen'],
      ['inter',   'Interruptores',      /^INTERRUPTOR/i,                             'gen'],
      ['trans',   'Transformadores',    /^(CUBRE TRANS|TRANSFORMADOR)/i,             'gen'],
      ['plat',    'Plataformas',        /^PLATAFORMA/i,                              'gen'],
      ['tirador', 'Tiradores',          /^TIRADOR/i,                                 'gen'],
      ['perso',   'Personalizaciones',  /^PERSONALIZACI/i,                           'gen'],
      ['comp',    'Complementos',       /^COMPLEMENTO/i,                             'gen'],
      ['resto',   'Sin categorizar',    /.*/,                                        'gen'],
    ]
  }
};

// Procesamiento: cada ref entra en la PRIMERA sub-entrada que matchee, globalmente
const globallySeen = new Set();
const finalData = {};
const orderedTabs = ['mod','esc','est','cam','arm','otr'];

orderedTabs.forEach(tabKey => {
  const tab = tabsConfig[tabKey];
  const subsOut = [];
  tab.subs.forEach(([jsKey, label, re, drawSub]) => {
    const items = refs
      .filter(r => !globallySeen.has(r.ref) && re.test(r.desc))
      .sort((a,b) => a.h - b.h || a.l - b.l);
    items.forEach(i => globallySeen.add(i.ref));
    if(items.length) subsOut.push({ jsKey, label, sub: drawSub, items });
  });
  finalData[tabKey] = { label: tab.label, color: tab.color, subs: subsOut };
});

// Reporte
console.log('\n═══ RESUMEN ═══');
let totalFinal = 0;
orderedTabs.forEach(k => {
  const sum = finalData[k].subs.reduce((a,s)=>a+s.items.length, 0);
  totalFinal += sum;
  console.log('  ', k.toUpperCase(), '·', finalData[k].subs.length, 'tipos,', sum, 'refs');
});
console.log('  TOTAL:', totalFinal, '/', refs.length,
  totalFinal === refs.length ? '✓ todas incluidas' : '⚠ faltan ' + (refs.length - totalFinal));

// ══════════════════════════════════════════════════════════
// Generar el bloque "var D" para inyectar en el plugin
// ══════════════════════════════════════════════════════════
function sanitize(s) {
  return String(s).replace(/["\\]/g, '').replace(/\s+/g, ' ').slice(0, 50);
}

function tabToJS(fam) {
  const tab = finalData[fam];
  const subsJS = tab.subs.map(s => {
    const itemsJS = s.items.map(i =>
      `{r:"${i.ref}",d:"${sanitize(i.desc)}",h:${i.h},l:${i.l},p:${i.p}}`
    ).join(',');
    return `{t:"${s.label}",sub:"${s.sub}",refs:[${itemsJS}]}`;
  }).join(',\n    ');
  return `${fam}:{lbl:"${tab.label} Tobisa",clr:"${tab.color}",ti:[\n    ${subsJS}\n  ]}`;
}

const varD = `var D = {\n  ${orderedTabs.map(tabToJS).join(',\n  ')}\n};`;

// ══════════════════════════════════════════════════════════
// Plantilla Ruby del plugin
// ══════════════════════════════════════════════════════════
const ruby = String.raw`# TOBISA JUVENIL & ARMARIOS v2.0 - PAU INTERIORISMO
# Generado automáticamente desde la tarifa técnica 2.51.2
# Todas las refs del catálogo (__TOTAL__) organizadas en 6 pestañas
require 'sketchup.rb'
require 'uri'

module PauInteriorismo
  module TobisaV20
    PLUGIN_DIR = File.dirname(__FILE__)

    def self.mostrar_panel
      dlg = UI::WebDialog.new('Tobisa Juvenil & Armarios', false, 'TobisaV20', 400, 760, 60, 60, true)
      dlg.set_html(generar_html)
      dlg.add_action_callback('ins') do |d, p|
        arr = p.split('|')
        ref   = arr[0]
        ancho = arr[1].to_i
        alto  = arr[2].to_i
        prof  = arr[3].to_i
        fam   = arr[4]
        sub   = arr[5] || ''
        desc  = arr[6] ? (URI.decode_www_form_component(arr[6]) rescue arr[6]) : ''
        mod = Sketchup.active_model
        mod.start_operation("#{ref} #{ancho}x#{alto}cm", true)
        begin
          insertar(mod, ref, ancho, alto, prof, fam, sub, desc)
          mod.commit_operation
        rescue => e
          mod.abort_operation
          UI.messagebox("Error: #{e.message}")
        end
      end
      dlg.show
    end

    def self.insertar(mod, ref, ancho, alto, prof, fam, sub, desc='')
      # Nombre único por ref+medidas — distintas medidas = distintos componentes
      nom = "T_#{ref}_#{ancho}x#{alto}_#{sub}"
      defs = mod.definitions
      comp = defs[nom]
      unless comp
        comp = defs.add(nom)
        dibujar(comp.entities, ref, ancho.to_f, alto.to_f, fam, sub, mod)
        # Etiqueta DENTRO del componente: flecha apunta al top-center, texto 6cm encima
        begin
          comp.entities.add_text(
            "#{ref}  #{ancho}×#{alto} cm",
            Geom::Point3d.new((ancho/2.0).cm, 0, alto.cm),
            Geom::Vector3d.new(0, 0, 6.cm)
          )
        rescue; end
        # Metadata persistente
        begin
          comp.set_attribute('PauTobisa', 'ref',   ref)
          comp.set_attribute('PauTobisa', 'desc',  desc)
          comp.set_attribute('PauTobisa', 'ancho', ancho)
          comp.set_attribute('PauTobisa', 'alto',  alto)
          comp.set_attribute('PauTobisa', 'prof',  prof)
          comp.set_attribute('PauTobisa', 'fam',   fam)
          comp.set_attribute('PauTobisa', 'sub',   sub)
        rescue; end
      end
      inst = mod.active_entities.add_instance(comp, Geom::Transformation.new)
      inst.name = "#{ref} #{ancho}x#{alto}"
      inst
    end

    def self.pt(x, z); Geom::Point3d.new(x.cm, 0, z.cm); end

    def self.fc(ents, pts, gris, mod)
      face = ents.add_face(pts)
      return unless face.is_a?(Sketchup::Face)
      face.reverse! if face.normal.y > 0
      if gris
        m = mod.materials['PG_TOBISA'] rescue nil
        unless m
          m = mod.materials.add('PG_TOBISA')
          m.color = Sketchup::Color.new(210,210,210)
        end
        face.material = m
        face.back_material = m
      end
    end

    def self.dibujar(ents, ref, w, h, fam, sub, mod)
      s = 1.5

      # ─── CAJONES ───
      if sub =~ /^caj(\d)$/
        n = $1.to_i
        z = h / n
        n.times do |i|
          fc(ents, [pt(0,z*i), pt(w,z*i), pt(w,z*(i+1)-s), pt(0,z*(i+1)-s)], true, mod)
        end

      # ─── CONTENEDORES ───
      elsif sub =~ /^cont(\d)$/
        n = $1.to_i
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        (1..n-1).each do |i|
          y = h * i / n.to_f
          ents.add_line(pt(0,y), pt(w,y))
        end

      # ─── DIÁFANO ───
      elsif sub == 'diaf'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], false, mod)

      # ─── PUERTAS ABATIBLES ───
      elsif sub == 'pta_izq'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(w,h), pt(0,0))
      elsif sub == 'pta_der'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(0,h), pt(w,0))
      elsif sub == 'pta_dd'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(0,h), pt(w/2.0,0))
        ents.add_line(pt(w/2.0,0), pt(w,h))
      elsif sub == 'pta_arm'
        # Puertas de armario (altas): diagonal indicando apertura
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(0,h), pt(w,0))

      # ─── 2 PUERTAS ABATIBLES ───
      elsif sub == 'pta2'
        fc(ents, [pt(0,0), pt(w/2.0,0), pt(w/2.0,h), pt(0,h)], true, mod)
        fc(ents, [pt(w/2.0,0), pt(w,0), pt(w,h), pt(w/2.0,h)], true, mod)
        ents.add_line(pt(0,h), pt(w/4.0,0))
        ents.add_line(pt(w/4.0,0), pt(w/2.0,h))
        ents.add_line(pt(w/2.0,h), pt(w*3/4.0,0))
        ents.add_line(pt(w*3/4.0,0), pt(w,h))

      # ─── CAJÓN + CONTENEDOR (cc, cc2, cc3, cc4) ───
      elsif sub =~ /^cc(\d?)$/
        variant = ($1=='' ? 1 : $1.to_i)
        nCaj = (variant >= 3 ? variant - 1 : 1)
        nCont = (variant == 2 ? 2 : 1)
        cjH = h * 0.30
        dz = cjH / nCaj
        nCaj.times do |i|
          fc(ents, [pt(0,dz*i), pt(w,dz*i), pt(w,dz*(i+1)-s), pt(0,dz*(i+1)-s)], true, mod)
        end
        fc(ents, [pt(0,cjH), pt(w,cjH), pt(w,h), pt(0,h)], true, mod)
        (1..nCont-1).each do |i|
          y = cjH + (h-cjH) * i / nCont.to_f
          ents.add_line(pt(0,y), pt(w,y))
        end

      # ─── CAJÓN + PUERTA ───
      elsif sub == 'cp'
        cj = h * 0.25
        fc(ents, [pt(0,0), pt(w,0), pt(w,cj-s), pt(0,cj-s)], true, mod)
        fc(ents, [pt(0,cj), pt(w,cj), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(0,h), pt(w/2.0,cj))
        ents.add_line(pt(w/2.0,cj), pt(w,h))

      # ─── ESCRITORIOS / ENCIMERAS ───
      elsif sub == 'escr' || sub == 'enci'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
      elsif sub == 'porter'
        pw = 5
        fc(ents, [pt(0,0), pt(pw,0), pt(pw,h), pt(0,h)], true, mod)
        fc(ents, [pt(w-pw,0), pt(w,0), pt(w,h), pt(w-pw,h)], true, mod)
        fc(ents, [pt(pw,h-5), pt(w-pw,h-5), pt(w-pw,h), pt(pw,h)], true, mod)

      # ─── ESTANTES / ESTANTERÍAS / CUBOS ───
      elsif sub == 'estm'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
      elsif sub == 'esttot'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], false, mod)
        ents.add_line(pt(0,0), pt(0,h))
        ents.add_line(pt(w,0), pt(w,h))
        n = [(h / 35.0).to_i, 2].max
        (1..n-1).each do |i|
          y = h * i / n.to_f
          ents.add_line(pt(0,y), pt(w,y))
        end
      elsif sub == 'cubo'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], false, mod)
        ents.add_line(pt(0,0), pt(0,h))
        ents.add_line(pt(w,0), pt(w,h))
        ents.add_line(pt(0,0), pt(w,0))
        ents.add_line(pt(0,h), pt(w,h))

      # ─── CAMAS ───
      elsif sub == 'camsing' || sub == 'cam_otros'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(3,h-3), pt(w-3,h-3))
      elsif sub == 'camab'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(0,0), pt(w,h))
        ents.add_line(pt(w,0), pt(0,h))
      elsif sub == 'camnid'
        cj = h * 0.4
        fc(ents, [pt(0,0), pt(w,0), pt(w,cj-s), pt(0,cj-s)], true, mod)
        fc(ents, [pt(0,cj), pt(w,cj), pt(w,h), pt(0,h)], true, mod)
      elsif sub == 'litera'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h/2.0-s), pt(0,h/2.0-s)], true, mod)
        fc(ents, [pt(0,h/2.0), pt(w,h/2.0), pt(w,h), pt(0,h)], true, mod)
        ents.add_line(pt(4,h/2.0-5), pt(w-4,h/2.0-5))
        ents.add_line(pt(4,h-3), pt(w-4,h-3))
      elsif sub == 'bastidor'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], false, mod)
        n = [3, (w/30.0).to_i].max
        (1..n).each do |i|
          y = h * i / (n+1.0)
          ents.add_line(pt(0,y), pt(w,y))
        end

      # ─── ARMARIOS (rectángulo alto con puertas) ───
      elsif sub == 'arm'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
        # Si es muy ancho, dividir en puertas
        npta = [(w/50.0).round, 1].max
        (1..npta-1).each do |i|
          x = w * i / npta.to_f
          ents.add_line(pt(x,0), pt(x,h))
        end

      # ─── ZÓCALO ───
      elsif sub == 'zoc'
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)

      # ─── GENÉRICO (fallback) ───
      else
        fc(ents, [pt(0,0), pt(w,0), pt(w,h), pt(0,h)], true, mod)
      end
    end

    def self.generar_html
      <<~'HTMLEOF'
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;background:#f2f2f2;overflow-x:hidden}
.hdr{background:#1a1a2e;padding:7px 10px;display:flex;align-items:center;gap:8px}
.ic{background:#6a1b9a;color:white;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;flex-shrink:0}
.ht{color:white;font-size:13px;font-weight:bold}.hs{color:#aaa;font-size:9px}
.tabs{display:flex;background:#2c2c2c}
.tab{flex:1;padding:6px 2px;text-align:center;color:#888;cursor:pointer;font-size:10px;border-bottom:3px solid transparent;transition:all .15s;font-weight:600}
.tab.on{color:white}
.cnt{padding:10px}
.stit{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.cnt2{background:#f3e5f5;border-radius:4px;padding:5px 8px;font-size:10px;color:#4a148c;margin-bottom:6px;text-align:center}
.lbl{display:block;font-size:10px;color:#555;margin:7px 0 3px;font-weight:bold}
select,input{width:100%;padding:5px 7px;border:1px solid #ccc;border-radius:4px;font-size:11px;background:white;font-family:inherit}
select.big{font-family:monospace;font-size:11px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:6px}
.grid3 div{display:flex;flex-direction:column}
.nano{font-size:9px;color:#666;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;text-align:center}
.grid3 input{text-align:center;font-weight:700;font-size:12px;padding:5px 3px}
.hint{font-size:9px;color:#888;margin:-2px 0 4px;font-style:italic}
.prev{background:white;border:1px solid #e0e0e0;border-radius:5px;padding:8px 11px;margin:8px 0}
.pr{font-size:18px;font-weight:bold;color:#1a1a2e;font-family:monospace}
.pd{font-size:10px;color:#666;margin-top:1px;line-height:1.3}
.pm{font-size:11px;font-weight:bold;margin-top:4px}
.ins{width:100%;padding:10px;color:white;border:none;border-radius:5px;font-size:12px;font-weight:bold;cursor:pointer;margin-top:2px;transition:opacity .2s}
.ins:hover{opacity:.85}
.ins[disabled]{opacity:.35;cursor:not-allowed}
.sep{height:1px;background:#e0e0e0;margin:6px 0}
.hide{display:none}
</style>
</head><body>
<div class="hdr">
  <div class="ic">P</div>
  <div><div class="ht">PAU Interiorismo</div><div class="hs">Tobisa &mdash; Alzado 2D &mdash; Tarifa 2.51.2</div></div>
</div>
<div class="tabs">
  <div class="tab" id="tb-mod" onclick="sf('mod')">Módu-<br><small>los</small></div>
  <div class="tab" id="tb-esc" onclick="sf('esc')">Escri-<br><small>torios</small></div>
  <div class="tab" id="tb-est" onclick="sf('est')">Estan-<br><small>terías</small></div>
  <div class="tab" id="tb-cam" onclick="sf('cam')">Camas<br><small>/literas</small></div>
  <div class="tab" id="tb-arm" onclick="sf('arm')">Arma-<br><small>rios</small></div>
  <div class="tab" id="tb-otr" onclick="sf('otr')">Otros<br><small>/zoc.</small></div>
</div>
<div class="cnt" id="cnt">
  <p style="color:#aaa;font-size:11px;text-align:center;margin-top:20px">Selecciona una familia</p>
</div>
<script>
__VAR_D_PLACEHOLDER__

var F=null, TI=-1, IDX=-1, CUR=null;

function sf(f){
  F=f; TI=-1; IDX=-1; CUR=null;
  ["mod","esc","est","cam","arm","otr"].forEach(function(x){
    var el=document.getElementById("tb-"+x); if(!el)return;
    if(x===f){el.classList.add("on");el.style.borderBottomColor=D[f].clr;el.style.color="white";}
    else{el.classList.remove("on");el.style.borderBottomColor="transparent";el.style.color="#888";}
  });
  var d=D[f];
  var totalRefs=0;
  for(var i=0;i<d.ti.length;i++) totalRefs+=d.ti[i].refs.length;
  var h='<div class="stit" style="color:'+d.clr+'">'+d.lbl+'</div>';
  h+='<div class="cnt2">'+d.ti.length+' tipos · '+totalRefs+' referencias</div>';
  h+='<span class="lbl">Tipo:</span>';
  h+='<select id="stype" onchange="sti(this.value)">';
  h+='<option value="">-- selecciona tipo --</option>';
  for(var i=0;i<d.ti.length;i++){
    h+='<option value="'+i+'">'+d.ti[i].t+' &nbsp;·&nbsp; ('+d.ti[i].refs.length+')</option>';
  }
  h+='</select>';
  h+='<div id="s2"></div>';
  document.getElementById("cnt").innerHTML=h;
}

function sti(i){
  i = parseInt(i); if(isNaN(i) || i<0){ document.getElementById("s2").innerHTML=""; return; }
  TI=i; IDX=-1; CUR=null;
  var d=D[F]; var ti=d.ti[i]; var c=d.clr;
  var h='<div class="sep"></div>';
  h+='<span class="lbl">Referencia:</span>';
  h+='<select class="big" id="sref" onchange="sref(this.value)">';
  h+='<option value="">-- selecciona referencia --</option>';
  for(var k=0;k<ti.refs.length;k++){
    var r=ti.refs[k];
    h+='<option value="'+k+'">'+r.r+' &nbsp;·&nbsp; H '+r.h+' × L '+r.l+' × P '+r.p+' cm</option>';
  }
  h+='</select>';
  h+='<div class="hint">📋 '+ti.refs.length+' refs ordenadas por alto × ancho</div>';

  // Inputs editables H/L/P
  h+='<span class="lbl">Medidas editables (cm):</span>';
  h+='<div class="grid3">';
  h+='<div><label class="nano">H alto</label><input type="number" id="ihh" min="1" max="400" oninput="updMed()"></div>';
  h+='<div><label class="nano">L ancho</label><input type="number" id="ill" min="1" max="400" oninput="updMed()"></div>';
  h+='<div><label class="nano">P fondo</label><input type="number" id="ipp" min="1" max="400" oninput="updMed()"></div>';
  h+='</div>';
  h+='<div class="hint">✏️ Los valores se auto-rellenan al elegir una ref; edítalos si lo necesitas.</div>';

  h+='<div class="prev hide" id="pv"><div class="pr" id="pr"></div><div class="pd" id="pd"></div><div class="pm" id="pm" style="color:'+c+'"></div></div>';
  h+='<button class="ins" id="bi" style="background:'+c+'" onclick="ins()" disabled>&#43; Insertar en plano</button>';
  document.getElementById("s2").innerHTML=h;
}

function sref(k){
  k = parseInt(k);
  if(isNaN(k) || k<0){
    CUR=null;
    document.getElementById("pv").classList.add("hide");
    document.getElementById("bi").disabled=true;
    document.getElementById("ihh").value="";
    document.getElementById("ill").value="";
    document.getElementById("ipp").value="";
    return;
  }
  IDX=k;
  var ti=D[F].ti[TI];
  CUR = ti.refs[k];
  document.getElementById("ihh").value = CUR.h;
  document.getElementById("ill").value = CUR.l;
  document.getElementById("ipp").value = CUR.p || 50;
  updMed();
}

function updMed(){
  if(!CUR) return;
  var h=parseFloat(document.getElementById("ihh").value)||0;
  var l=parseFloat(document.getElementById("ill").value)||0;
  var p=parseFloat(document.getElementById("ipp").value)||0;
  var pv=document.getElementById("pv"); var bi=document.getElementById("bi");
  if(h>0 && l>0){
    document.getElementById("pr").textContent = CUR.r;
    document.getElementById("pd").textContent = CUR.d;
    document.getElementById("pm").textContent = "H "+h+" × L "+l+" × P "+p+" cm";
    pv.classList.remove("hide");
    bi.disabled=false;
  } else {
    pv.classList.add("hide");
    bi.disabled=true;
  }
}

function ins(){
  if(!CUR) return;
  var h=parseFloat(document.getElementById("ihh").value)||CUR.h;
  var l=parseFloat(document.getElementById("ill").value)||CUR.l;
  var p=parseFloat(document.getElementById("ipp").value)||0;
  if(h<=0 || l<=0){ alert("H y L deben ser mayores que 0"); return; }
  var ti=D[F].ti[TI];
  var desc=(CUR.d||"").replace(/\|/g,"-");
  window.location = "skp:ins@" + CUR.r + "|" + l + "|" + h + "|" + p + "|" + F + "|" + ti.sub + "|" + encodeURIComponent(desc);
}

sf("mod");
</script>
</body></html>
      HTMLEOF
    end

    unless file_loaded?(__FILE__)
      tb = UI::Toolbar.new("Tobisa Juvenil")
      cmd = UI::Command.new("Tobisa") { mostrar_panel }
      cmd.tooltip = "Tobisa Juvenil & Armarios - PAU Interiorismo"
      cmd.status_bar_text = "Insertar modulos Tobisa en alzado 2D"
      i16 = File.join(PLUGIN_DIR, "pau_16.png")
      i24 = File.join(PLUGIN_DIR, "pau_24.png")
      if File.exist?(i16)
        cmd.small_icon = i16
        cmd.large_icon = File.exist?(i24) ? i24 : i16
      end
      tb.add_item(cmd)
      tb.restore
      UI.menu("Plugins").add_item("PAU - Tobisa Juvenil & Armarios") { mostrar_panel }
      file_loaded(__FILE__)
    end

  end
end
`;

const finalRuby = ruby
  .replace('__VAR_D_PLACEHOLDER__', varD)
  .replace('__TOTAL__', String(totalFinal));

const outPath = 'C:/Users/Usuario/AppData/Roaming/SketchUp/SketchUp 2022/SketchUp/Plugins/tobisa_pau/tobisa_cocinas.rb';
fs.writeFileSync(outPath, finalRuby);

console.log('\n✅ Plugin escrito:', outPath);
console.log('   Tamaño:', (finalRuby.length/1024).toFixed(1), 'KB');
console.log('   Refs embebidas:', totalFinal);

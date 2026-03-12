// /api/parse-invoice.js — Vercel Serverless Function (CommonJS)
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { pdfText } = req.body || {};
  if (!pdfText || pdfText.trim().length < 10) {
    return res.status(400).json({ error: 'No hay texto del PDF' });
  }

  const PROVEEDORES = [
    "ABDELHAK BOUZIZOUA SAID","Aguas de Valencia - Aguas de Valencia SA",
    "Aquaservice - Viva Aqua Service Spain SA","AROMAS DEL CAMPO - AROMAS DEL CAMPO LIGHTING S.L.U.",
    "Asesoría Jose Carmelo Palau - Jose Carmelo Palau S.L","BATEIG PIEDRA NATURALBateig",
    "BRICOLAJE BRICOMAN SLU","C.DOMA - SERVICIOS DE RECOGIDA ECOLOGICOS SLL",
    "Cafrán Norte SLU","CAMENGO ESPAÑA SL","CANALONES MEDITERRANEA",
    "COMERCIAL Y DERIVADOS ELECTRICOS SL","Comercial y derivados eléctricos SL",
    "D Aqua Kitchen & Living SL","DESARROLLO Y TECNICAS DEL BAÑOS.L.U",
    "Desarrollo y Técnicas del Baño SLU","Disclima SL","DISCLIMA",
    "Efecto Led - PRISMICA SLU","Emilio Montador - Emilio J. Monterde Sanchez",
    "F Franco e Hijos SL","FERRETERIA TEN Y MONREAL S.L.","Ferretería Ten y Monreal SL",
    "Fiora bath collections  SL","FIORA BATH COLLECTIONS SOCIEDAD LIMITADA.",
    "FNMT-RCM","Franca Grupo Inmobiliario","Franco Furniture - F Franco e Hijos SL",
    "Fustes Bonet Llopis SL","Garcia Zacares SL","Glicerio Chaves Hornero SL",
    "Grupo Mundobaño Electrokitchen SL","Holded","Iberdrola - Iberdrola clientes SAU",
    "Iván Millán Garcia","IXIA REGAL SA","Jose Asins Primo","Jose Ignacio Chilet Crespo",
    "Marmoles Santa Maria - MARMOLES SANTAMARIA SL","Materiales Calabuig SL",
    "MERCEDES BENZ - MERCEDES BENZ ESPAÑA SOCIEDAD ANONIMA",
    "Mercedes Benz - Mercedes Benz Financial services España EFC SA",
    "Moeve - Moeve Card Services, S.A.U.","Moeve - Moeve pro services SAU",
    "Mohammed Ghanouch","Movistar - Telefónica móviles España SAU","Mármoles Santa maría SL",
    "NAVARRO RUBIO SILLERIA S. L.","Navarro Rubio Silleria SL",
    "NESTLE NESPRESSO SA OFICINA DE REPRESENTACION EN BARCELONA",
    "O.T.P. OFICINA TECNICA DE PREVENCION, S.A. - OTP-OFICINA TECNICA DE PREVENCION SL",
    "Optica Alcasser - DOSMIRADAS2020,SL","Otp-Oficina Técnica de Prevención SL",
    "Pinturas Gopidecor SL","PINTURAS GOPIDECOR SOCIEDAD LIMITADA.","Poalgi SL",
    "Prismica SLU","PUERTAS SEVILLANO SL","Pulidor - Jose Vicente Figueres Peris",
    "Rafael Albert SL","RAFAEL ALBERT, S.L.","Raúl Martín - Engenios Sanchez",
    "Said Pladur - SAID LOUDYI","Saitra Cocinas SL","Saniceramic Import And Export Sl",
    "SIMO PINTOR - MOHAMMED GHANOUCH","Stanila Adrián Ioan",
    "Tancat Cerramientos - Raul Martín-Engenios Sänchez",
    "Techos Calabuig - MATERIALES CALABUIG SOCIEDAD LIMITADA.",
    "TEXTILES INDUCAM","Tobisa Fabrica de Muebles SL",
    "TOBISA MUEBLES - TOBISA FABRICA DE MUEBLES SL",
    "VENTANAS CORTIZO - VICMAN GLASS S.L.U.","Vicentclima SL","Vicman Glass SLU",
    "Vives Azulejos y Gres SA","VIVES AZULEJOS Y GRES, S.A. - VIVES AZULEJOS Y GRES SA",
    "Vodafone España SAU"
  ];

  const prompt = `Eres un sistema de extracción de datos de facturas españolas.

Analiza el siguiente texto y devuelve ÚNICAMENTE un objeto JSON válido, sin markdown, sin texto extra.

PROVEEDORES REGISTRADOS (usa el nombre exacto de esta lista si coincide con el emisor):
${JSON.stringify(PROVEEDORES)}

CAMPOS A EXTRAER:
- invoice_number: número de factura del emisor. Busca etiquetas como "N.º", "Nº", "Factura", "Invoice". NUNCA uses número de albarán.
- supplier_name: el EMISOR (quien cobra), no PAU INTERIORISMO que es el cliente. Busca coincidencia en la lista de proveedores.
- issue_date: fecha de emisión en formato DD/MM/YYYY
- tax_base: base imponible como número (ej: 358.00)
- vat_percent: porcentaje IVA como número (4, 10 o 21)
- vat_amount: importe IVA como número
- total_amount: total factura como número
- payment_method: uno de exactamente: "Domiciliación", "Transferencia", "Giro", "Pagaré", "Confirming", "Efectivo". Si no está claro usa "Domiciliación".
- due_dates: array [{date:"DD/MM/YYYY", amount:número}]. Si no hay vencimientos, array vacío [].
- concept: descripción corta del producto/servicio (máximo 80 chars). null si no está claro.

TEXTO DE LA FACTURA:
${pdfText.slice(0, 4000)}`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    // Llamada HTTPS nativa (sin fetch, compatible con Node 16/18)
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const reqApi = https.request(options, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });
      reqApi.on('error', reject);
      reqApi.write(body);
      reqApi.end();
    });

    const data = JSON.parse(result.body);
    if (result.status !== 200) {
      console.error('Anthropic error:', result.body);
      return res.status(500).json({ error: 'Error API Claude', detail: data });
    }

    const rawText = data.content?.[0]?.text || '';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('parse-invoice error:', err);
    return res.status(500).json({ error: 'Error procesando factura', detail: err.message });
  }
};

// Vercel Serverless Function — /api/parse-invoice
// Recibe: { pdfText: string }
// Devuelve: { numFra, fecha, base, iva, total, formaPago, proveedor, vencimientos:[{fecha,importe}] }

export default async function handler(req, res) {
  // CORS para que funcione desde pau-interiorismo.vercel.app
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

  const prompt = `Eres un sistema de extracción de datos de facturas españolas para una empresa de construcción e interiorismo.

Analiza el siguiente texto de factura y extrae los datos. Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones.

LISTA DE PROVEEDORES REGISTRADOS (usa exactamente uno de estos nombres si coincide con el emisor):
${JSON.stringify(PROVEEDORES)}

REGLAS IMPORTANTES:
- invoice_number: número de factura del EMISOR (busca "N.º", "Nº", "Factura N°", "Invoice", etc.). NUNCA uses número de albarán, pedido ni referencia interna.
- supplier_name: el EMISOR de la factura (quien cobra), NO PAU INTERIORISMO que es el cliente. Busca en la lista de proveedores la coincidencia más cercana.
- issue_date: fecha de EMISIÓN de la factura en formato DD/MM/YYYY. No la fecha de albarán ni vencimiento.
- tax_base: base imponible en número decimal. Si hay varias líneas, es la etiquetada "Base imponible".
- vat_percent: porcentaje de IVA (4, 10 o 21).
- vat_amount: importe del IVA en decimal.
- total_amount: total final de la factura.
- payment_method: mapear a exactamente uno de: "Domiciliación", "Transferencia", "Giro", "Pagaré", "Confirming", "Efectivo". Si no se indica claramente, usa "Domiciliación".
- due_dates: array de objetos {date: "DD/MM/YYYY", amount: número} con los vencimientos. Si no hay, array vacío.
- concept: descripción corta del producto/servicio principal (máximo 80 caracteres). Si no está claro, null.

TEXTO DE LA FACTURA:
${pdfText.slice(0, 4000)}

JSON de respuesta (solo esto, nada más):`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // rápido y barato para extracción
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic error:', data);
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
}

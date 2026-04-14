// /api/herramienta-proxy.js — Vercel Serverless Function (CommonJS)
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

  try {
    const body = JSON.stringify(req.body);

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
      return res.status(result.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('herramienta-proxy error:', err);
    return res.status(500).json({ error: 'Error en proxy Anthropic', detail: err.message });
  }
};

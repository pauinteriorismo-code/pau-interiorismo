const SB_URL = ‘https://qxyflndntpmcdbyvwjnj.supabase.co’;
const SB_KEY = ‘eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4eWZsbmRudHBtY2RieXZ3am5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjgzOTMsImV4cCI6MjA4NzUwNDM5M30.WQ193I6oS9ANMvuWG8XXa_J6oFleoTSlLQKeFVR_d50’;

export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET, POST, PATCH, PUT, DELETE, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type, Authorization’);
if (req.method === ‘OPTIONS’) return res.status(200).end();

try {
const { table, method = ‘GET’, extra = ‘’, id } = req.query;
if (!table) return res.status(400).json({ error: ‘table required’ });

```
let path = '/rest/v1/' + table;
if (id) path += '?id=eq.' + id;
if (extra) path += (path.includes('?') ? '&' : '?') + extra.replace(/^\?/, '');

const headers = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};
if (method === 'POST') headers['Prefer'] = 'return=representation';

const bodyData = (req.body && req.body.body) ? req.body.body : null;
const sbRes = await fetch(SB_URL + path, {
  method: method,
  headers: headers,
  body: (method !== 'GET' && method !== 'DELETE' && bodyData) ? JSON.stringify(bodyData) : undefined,
});

const text = await sbRes.text();
if (!sbRes.ok) return res.status(sbRes.status).json({ error: text });
res.setHeader('Content-Type', 'application/json');
return res.status(200).send(text || '[]');
```

} catch (e) {
return res.status(500).json({ error: e.message });
}
}

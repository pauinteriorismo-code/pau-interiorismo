{
“headers”: [
{
“source”: “/(.*)”,
“headers”: [
{
“key”: “Content-Security-Policy”,
“value”: “default-src ‘self’ ‘unsafe-inline’ ‘unsafe-eval’ https://*.supabase.co https://*.supabase.in https://cdnjs.cloudflare.com data: blob:; connect-src ‘self’ https://*.supabase.co https://*.supabase.in; img-src ‘self’ data: blob: https:; font-src ‘self’ data: https:;”
},
{
“key”: “Access-Control-Allow-Origin”,
“value”: “*”
},
{
“key”: “Access-Control-Allow-Methods”,
“value”: “GET, POST, PATCH, DELETE, OPTIONS”
},
{
“key”: “Access-Control-Allow-Headers”,
“value”: “Content-Type, Authorization, apikey, Prefer”
}
]
}
]
}

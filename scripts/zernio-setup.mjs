// Zernio: crea (o reutiliza) el perfil del Hotel Andy y genera un enlace para conectar su primera cuenta.
// Uso:  pnpm zernio:setup [plataforma]     (por defecto: whatsapp)
// Lee ZERNIO_API_KEY de .env. Opcionales: ZERNIO_REDIRECT_URL, ZERNIO_ONBOARDING (p. ej. "api" para WhatsApp sin coexistencia).
// Docs: https://zernio.com/llms.txt · https://docs.zernio.com/platforms/whatsapp · https://docs.zernio.com/multi-tenant

const BASE = process.env.ZERNIO_BASE_URL ?? 'https://zernio.com/api/v1';
const KEY = process.env.ZERNIO_API_KEY;
const HOTEL = { name: 'Hotel Andy', externalId: '00000000-0000-4000-8000-0000000a0d1e' }; // externalId = hoteles.id en Supabase
const platform = process.argv[2] ?? 'whatsapp';

if (!KEY) {
  console.error('Falta ZERNIO_API_KEY. Ponla en .env (créala en el panel de Zernio → API Keys).');
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, requestId: res.headers.get('x-request-id') };
}

function fallar(paso, r) {
  console.error(`Error en ${paso}: HTTP ${r.status} ${r.data.code ?? ''} ${r.data.error ?? ''}`.trim());
  if (r.data.dashboard_url || r.data.billingUrl) console.error(`Revisa la facturación: ${r.data.dashboard_url ?? r.data.billingUrl}`);
  if (r.requestId) console.error(`x-request-id: ${r.requestId}`);
  process.exit(1);
}

// 1. Perfil: se busca por externalId para que correr el script dos veces no cree un segundo perfil.
let r = await api('GET', `/profiles?externalId=${encodeURIComponent(HOTEL.externalId)}`);
if (r.status !== 200) fallar('buscar perfil', r);
let profileId = r.data.profiles?.[0]?._id;

if (profileId) {
  console.log(`Perfil existente: ${profileId}`);
} else {
  r = await api('POST', '/profiles', { ...HOTEL, description: 'Hotel de playa en Atacames, Esmeraldas' });
  if (r.status === 409 && r.data.details?.existingProfileId) {
    profileId = r.data.details.existingProfileId;
    console.log(`Perfil existente: ${profileId}`);
  } else if (r.status === 201 || r.status === 200) {
    profileId = r.data.profile._id;
    console.log(`Perfil creado: ${profileId}`);
  } else fallar('crear perfil', r);
}

// 2. Enlace de conexión para la primera cuenta del perfil.
const q = new URLSearchParams({ profileId });
if (process.env.ZERNIO_REDIRECT_URL) q.set('redirect_url', process.env.ZERNIO_REDIRECT_URL);
if (process.env.ZERNIO_ONBOARDING) q.set('onboarding', process.env.ZERNIO_ONBOARDING);
r = await api('GET', `/connect/${platform}?${q}`);
if (r.status !== 200) fallar(`generar enlace de ${platform}`, r);

if (r.data.alreadyConnected) {
  console.log(`La cuenta de ${platform} ya estaba conectada: ${r.data.accountId}`);
} else {
  console.log(`\nAbre este enlace para conectar ${platform} (caduca pronto):\n${r.data.authUrl}\n`);
}
console.log(`Guarda en .env:  ZERNIO_PROFILE_ID=${profileId}`);

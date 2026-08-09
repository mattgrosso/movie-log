const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');

const client = new Anthropic();

// MODEL CHOICE IS A COST DECISION. Every prompt here is just a title and a
// year, so none of this needs a frontier model. All three routes used to be on
// Opus ($5/$25 per M tokens), which at ~5k calls/day would be roughly
// $3,000/month.
//
//   keywords -> Haiku. Thematic labels; nothing to get factually wrong.
//   context / trivia -> Sonnet. These have to be TRUE, and cheap models
//     confabulate hardest on obscure factual recall. Trivia in particular is
//     unverifiable to the player, so a wrong "fact" just quietly becomes part
//     of the game. Still materially cheaper than Opus.
//
// If trivia quality holds up on Sonnet, dropping it to Haiku is a one-line
// further saving.
const MODELS = {
  keywords: 'claude-haiku-4-5-20251001',
  context: 'claude-sonnet-5',
  trivia: 'claude-sonnet-5'
};

// This endpoint spends money on every call and its URL is baked into the
// public client bundle, so it cannot be open. CORS is NOT the gate — it only
// constrains browsers, and anything server-side ignores it — the Firebase ID
// token below is.
const ALLOWED_ORIGINS = [
  'https://www.cinemaroll.org',
  'https://cinemaroll.org',
  'http://localhost:8080'
];

const FIREBASE_PROJECT_ID = 'movie-log-8c4d5';
const FIREBASE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
});

// Set per-invocation so the response echoes the caller's origin.
let activeOrigin = ALLOWED_ORIGINS[0];

const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders(activeOrigin),
  body: JSON.stringify(body)
});

// --- Firebase ID token verification -----------------------------------------
// Done with node's built-in crypto rather than firebase-admin: it's ~40 lines,
// and it keeps the deployment zip small and free of a dependency that would
// need keeping up to date. Requires Node 18+ for global fetch (the function
// runs on nodejs22.x).

let certCache = { keys: null, expiresAt: 0 };

const fetchCerts = async () => {
  if (certCache.keys && Date.now() < certCache.expiresAt) {
    return certCache.keys;
  }

  const res = await fetch(FIREBASE_CERT_URL);
  if (!res.ok) throw new Error(`Could not fetch Firebase certs: ${res.status}`);
  const keys = await res.json();

  // Google tells us how long these are good for; honour it rather than
  // re-fetching on every cold container.
  const maxAge = Number((/max-age=(\d+)/.exec(res.headers.get('cache-control') || '') || [])[1] || 3600);
  certCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
};

const fromBase64Url = (value) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const verifyIdToken = async (authorization) => {
  const token = (authorization || '').replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(parts[0]).toString('utf8'));
    payload = JSON.parse(fromBase64Url(parts[1]).toString('utf8'));
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) return null;

  const certs = await fetchCerts();
  const cert = certs[header.kid];
  if (!cert) return null;

  const signatureValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey(cert),
    fromBase64Url(parts[2])
  );
  if (!signatureValid) return null;

  // Every one of these matters: without the audience and issuer checks a valid
  // token from ANY Firebase project would be accepted.
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) return null;
  if (payload.aud !== FIREBASE_PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
  if (!payload.sub) return null;

  return payload;
};

// --- Rate limiting ----------------------------------------------------------
// Per-container and in-memory, so it is a speed bump rather than a guarantee:
// Lambda may run many containers concurrently and each keeps its own counter,
// and a cold start resets it. It still stops a single client hammering the
// endpoint in a loop, which is the realistic abuse case. For a hard ceiling,
// set a throttle on the API Gateway stage as well — that's the real backstop
// and it needs no code.
const RATE_LIMIT = { windowMs: 60_000, maxPerWindow: 20 };
const recentCalls = new Map();

const withinRateLimit = (uid) => {
  const now = Date.now();
  const calls = (recentCalls.get(uid) || []).filter((at) => now - at < RATE_LIMIT.windowMs);

  if (calls.length >= RATE_LIMIT.maxPerWindow) {
    recentCalls.set(uid, calls);
    return false;
  }

  calls.push(now);
  recentCalls.set(uid, calls);

  // Don't let the map grow without bound across a long-lived container.
  if (recentCalls.size > 500) {
    for (const [key, times] of recentCalls) {
      if (!times.some((at) => now - at < RATE_LIMIT.windowMs)) recentCalls.delete(key);
    }
  }

  return true;
};

const getContext = async ({ title, year }) => {
  if (!title) {
    return response(400, { error: 'Title is required' });
  }

  const message = await client.messages.create({
    model: MODELS.context,
    // Was 512, which visibly truncated the answer mid-sentence — Sonnet is
    // wordier than the Opus this used to run on.
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Give me some brief critical and historical context for the movie "${title}"${year ? ` (${year})` : ''}.
Cover how it was received at the time of release, its cultural or historical significance, and any notable influences or legacy. Are there any interesting production details?
Keep it to 3-4 sentences. Be direct and informative, not promotional.`
      }
    ]
  });

  return response(200, { context: message.content[0].text });
};

const getTrivia = async ({ title, year }) => {
  if (!title) {
    return response(400, { error: 'Title is required' });
  }

  const message = await client.messages.create({
    model: MODELS.trivia,
    // Was 768. Five facts of 1-2 sentences plus JSON overhead runs past that
    // on Sonnet, and a truncated response has no closing brace — which used
    // to crash the extraction below and surface as "couldn't load trivia".
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `Give me 5 pieces of trivia about the movie "${title}"${year ? ` (${year})` : ''}, for a guessing game where a player is shown one fact at a time and tries to guess the movie.

Order them from HARDEST/most obscure (revealed first) to EASIEST/most identifying (revealed last) - the last one or two can be quite giveaway-ish, but the first few should require real movie knowledge and should NOT be dry facts like runtime, budget, or release date (the game already has separate access to those).

Rules:
- Do not mention the movie's title, or any alternate/working title, in any fact.
- Prefer genuinely interesting behind-the-scenes, production, casting, reception, or legacy trivia over generic plot description.
- Each fact should be 1-2 sentences, self-contained, and true - do not invent or guess at trivia you are not confident is accurate.
- It's fine for later, easier facts to name the director or lead actors if that's genuinely how the trivia goes, but earlier facts should avoid it when possible.

Return only a JSON object with a single key "facts" whose value is an array of exactly 5 strings, ordered hardest to easiest.`
      }
    ]
  });

  // Defensive on both counts: .match() returns null when the response was
  // truncated before its closing brace, and `null[0]` threw a TypeError that
  // the caller could only report as a generic failure. Say what actually
  // happened instead, and include stop_reason so a repeat is diagnosable
  // without CloudWatch access.
  const text = message.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Trivia response had no JSON object. stop_reason:', message.stop_reason, 'text:', text.slice(0, 400));
    return response(502, { error: 'AI returned no usable trivia', stopReason: message.stop_reason, facts: [] });
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Trivia JSON did not parse. stop_reason:', message.stop_reason, 'text:', text.slice(0, 400));
    return response(502, { error: 'AI returned malformed trivia', stopReason: message.stop_reason, facts: [] });
  }

  const facts = (Array.isArray(parsed.facts) ? parsed.facts : []).filter((fact) => typeof fact === 'string' && fact.trim()).slice(0, 5);

  return response(200, { facts });
};

const getKeywords = async ({ title, year }) => {
  if (!title) {
    return response(400, { error: 'Title is required' });
  }

  const message = await client.messages.create({
    model: MODELS.keywords,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `Give me a list of keywords for the movie "${title}"${year ? ` (${year})` : ''}.
Include keywords for themes, genre, mood, and the location or locations where the movie takes place.
Return only a JSON object with a single key "keywords" whose value is an array of lowercase strings.`
      }
    ]
  });

  const text = message.content[0].text;
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
  const keywords = (parsed.keywords || []).map(k => k.toLowerCase());

  return response(200, { keywords });
};

exports.handler = async (event) => {
  const headers = event.headers || {};
  activeOrigin = headers.origin || headers.Origin || ALLOWED_ORIGINS[0];

  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === 'OPTIONS') {
    return response(200, '');
  }

  if (method !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  // Signed-in callers only. Empty arrays are included so a client that loses
  // its session degrades to "no suggestions" instead of throwing.
  let user;
  try {
    user = await verifyIdToken(headers.authorization || headers.Authorization);
  } catch (error) {
    console.error('Token verification failed:', error);
    return response(503, { error: 'Could not verify credentials', keywords: [], facts: [] });
  }

  if (!user) {
    return response(401, { error: 'Sign-in required', keywords: [], facts: [] });
  }

  if (!withinRateLimit(user.sub)) {
    return response(429, { error: 'Too many requests, slow down', keywords: [], facts: [] });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const route = event.path || event.rawPath || '/keywords';

  try {
    if (route.endsWith('/keywords')) {
      return await getKeywords(body);
    }

    if (route.endsWith('/context')) {
      return await getContext(body);
    }

    if (route.endsWith('/trivia')) {
      return await getTrivia(body);
    }

    return response(404, { error: 'Unknown route' });
  } catch (error) {
    console.error('Claude API error:', error);
    return response(500, { error: 'AI request failed', keywords: [], facts: [] });
  }
};

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const response = (statusCode, body) => ({
  statusCode,
  headers: CORS_HEADERS,
  body: JSON.stringify(body)
});

const getContext = async ({ title, year }) => {
  if (!title) {
    return response(400, { error: 'Title is required' });
  }

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 512,
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

const getKeywords = async ({ title, year }) => {
  if (!title) {
    return response(400, { error: 'Title is required' });
  }

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
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
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === 'OPTIONS') {
    return response(200, '');
  }

  if (method !== 'POST') {
    return response(405, { error: 'Method not allowed' });
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

    return response(404, { error: 'Unknown route' });
  } catch (error) {
    console.error('Claude API error:', error);
    return response(500, { error: 'AI request failed', keywords: [] });
  }
};

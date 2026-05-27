import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(__dirname, '..', '.env'));

const PORT = Number(readEnv('PORT') || 54321);
const SUPABASE_URL = readEnv('SUPABASE_URL') || readEnv('VITE_SUPABASE_URL');
const SUPABASE_ANON_KEY = readEnv('SUPABASE_ANON_KEY') || readEnv('VITE_SUPABASE_ANON_KEY');
const GEMINI_MODEL = readEnv('GEMINI_MODEL') || 'gemini-2.0-flash';
const GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';
const GOOGLE_SEARCH_ENGINE_PLACEHOLDER = 'your_search_engine_id_here';
const ENABLE_EXTERNAL_AI = readBooleanEnv('ENABLE_EXTERNAL_AI');
const ENABLE_GOOGLE_SEARCH = readBooleanEnv('ENABLE_GOOGLE_SEARCH');
const LOCAL_AI_PROVIDER = (readEnv('LOCAL_AI_PROVIDER') || 'ollama').toLowerCase();
const OLLAMA_BASE_URL = readEnv('OLLAMA_BASE_URL');
const OLLAMA_MODEL = readEnv('OLLAMA_MODEL');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function sendJson(res, status, payload) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const envText = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function readBooleanEnv(name) {
  return ['1', 'true', 'yes', 'on'].includes(readEnv(name).toLowerCase());
}

function getGeminiApiKey() {
  return (
    readEnv('GEMINI_API_KEY') ||
    readEnv('GOOGLE_GENERATIVE_AI_API_KEY') ||
    readEnv('GOOGLE_API_KEY')
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function generateFallbackResponse(messages, firstName) {
  const lastUserMessage = messages[messages.length - 1]?.content || '';
  const lowerMsg = lastUserMessage.toLowerCase();
  const nameStr = firstName ? `, ${firstName}` : '';

  if (
    lowerMsg.includes('who created you') ||
    lowerMsg.includes('who made you') ||
    lowerMsg.includes('who built you') ||
    lowerMsg.includes('your creator')
  ) {
    return `I was created by Raphael Lucky Uke. I'm Nex, an AI assistant built to help with writing, coding, research, brainstorming, explanations, and more.`;
  }

  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    return `Hey there${nameStr}! I'm Nex, your AI assistant. I'm here to help with analysis, writing, coding, research, and more. What can I help you with today?`;
  }

  if (lowerMsg.includes('help')) {
    return `I can help you with writing, coding, analysis, math, research, and creative tasks${nameStr}. Ask me anything and I'll do my best.`;
  }

  return `Thanks for your message${nameStr}! I'm Nex, your AI assistant. To use local AI, start Ollama and run the configured model (${OLLAMA_MODEL || 'none set'}).`;
}

class GoogleSearchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GoogleSearchError';
    this.code = code;
    this.details = details;
  }
}

function isSimpleGreeting(message) {
  const normalized = message
    .trim()
    .toLowerCase()
    .replace(/[!?.\s]+$/g, '');

  return /^(hello|hi|hey|yo|good morning|good afternoon|good evening)$/.test(normalized);
}

function shouldSearchGoogle(message) {
  const normalized = message.trim().toLowerCase();
  if (normalized.length <= 2 || isSimpleGreeting(normalized)) return false;

  return [
    'search',
    'google',
    'look up',
    'lookup',
    'web',
    'internet',
    'source',
    'latest',
    'current',
    'today',
    'news',
    'recent',
    'up to date',
  ].some(keyword => normalized.includes(keyword));
}

function getActivationUrl(errorPayload) {
  const helpLinks = errorPayload?.error?.details
    ?.find(detail => Array.isArray(detail.links))
    ?.links;
  const metadataUrl = errorPayload?.error?.details
    ?.find(detail => detail.metadata?.activationUrl)
    ?.metadata?.activationUrl;

  return helpLinks?.[0]?.url || metadataUrl || '';
}

function getGoogleSearchErrorCode(status, errorPayload, errorText) {
  const googleReason = errorPayload?.error?.details
    ?.find(detail => detail.reason)
    ?.reason;
  const googleStatus = errorPayload?.error?.status || '';
  const lowerErrorText = errorText.toLowerCase();

  if (
    status === 403 &&
    (googleReason === 'SERVICE_DISABLED' || lowerErrorText.includes('custom search api has not been used'))
  ) {
    return 'custom_search_api_disabled';
  }

  if (status === 403 && googleStatus === 'PERMISSION_DENIED') {
    return 'permission_denied';
  }

  if (status === 429) {
    return 'quota_exceeded';
  }

  return `http_${status}`;
}

async function searchGoogle(query) {
  const apiKey = readEnv('GOOGLE_SEARCH_API_KEY') || getGeminiApiKey();
  const searchEngineId = readEnv('GOOGLE_SEARCH_ENGINE_ID');

  if (!apiKey) {
    throw new GoogleSearchError(
      'missing_api_key',
      'GOOGLE_SEARCH_API_KEY is missing. Add it to .env, then restart the backend.',
    );
  }

  if (!searchEngineId || searchEngineId === GOOGLE_SEARCH_ENGINE_PLACEHOLDER) {
    throw new GoogleSearchError(
      'missing_search_engine_id',
      'GOOGLE_SEARCH_ENGINE_ID is missing. Add it to .env, then restart the backend.',
    );
  }

  const url = new URL(GOOGLE_SEARCH_ENDPOINT);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', searchEngineId);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '5');
  url.searchParams.set('safe', 'active');

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    let errorPayload = null;
    try {
      errorPayload = JSON.parse(errorText);
    } catch {
      // Keep the raw response text for logging below.
    }

    const code = getGoogleSearchErrorCode(response.status, errorPayload, errorText);
    throw new GoogleSearchError(
      code,
      `Google Search API error: ${response.status} - ${errorText}`,
      {
        activationUrl: getActivationUrl(errorPayload),
        status: response.status,
      },
    );
  }

  const data = await response.json();
  return (data.items || []).map(item => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
  }));
}

function formatSearchResults(results) {
  return results
    .map((result, index) => {
      return [
        `[${index + 1}] ${result.title}`,
        result.link,
        result.snippet,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function describeGoogleSearchIssue(error) {
  if (!error) {
    return 'Google search returned no results for this message.';
  }

  if (error.code === 'missing_api_key') {
    return 'Google search is not configured yet. Add GOOGLE_SEARCH_API_KEY to .env, then restart the backend.';
  }

  if (error.code === 'missing_search_engine_id') {
    return 'Google search is not configured yet. Add GOOGLE_SEARCH_ENGINE_ID to .env, then restart the backend.';
  }

  if (error.code === 'custom_search_api_disabled') {
    const activationNote = error.details?.activationUrl
      ? ` Enable it here: ${error.details.activationUrl}`
      : ' Enable the Custom Search JSON API in Google Cloud.';

    return `Google search is configured, but the Custom Search API is disabled for this API key's Google Cloud project.${activationNote} Then wait a few minutes and restart the backend.`;
  }

  if (error.code === 'permission_denied') {
    return 'Google search is configured, but Google rejected the request. Check that the API key can use the Custom Search API and that the search engine ID is valid.';
  }

  if (error.code === 'quota_exceeded') {
    return 'Google search is configured, but the Google Search API quota or rate limit has been reached. Try again later or use a key with available quota.';
  }

  return 'Google search is configured, but the Google Search API request failed. Check backend.err.log for the detailed Google response.';
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizeErrorText(value) {
  const key = getGeminiApiKey();
  const text = String(value || '');
  return key ? text.replaceAll(key, '<redacted>') : text;
}

function createGeminiError(status, errorText) {
  const payload = parseJsonSafe(errorText);
  const apiError = payload?.error;
  const googleStatus = apiError?.status || '';
  const message = apiError?.message || errorText || 'Unknown Gemini API error';
  const statusLabel = googleStatus ? ` (${googleStatus})` : '';
  const error = new Error(`Gemini API error: ${status}${statusLabel} - ${sanitizeErrorText(message)}`);
  error.status = status;
  error.code = googleStatus;
  error.details = sanitizeErrorText(message);
  return error;
}

function buildGeminiUrl(apiKey) {
  const modelPath = GEMINI_MODEL.startsWith('models/') ? GEMINI_MODEL : `models/${GEMINI_MODEL}`;
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:streamGenerateContent`);
  url.searchParams.set('alt', 'sse');
  url.searchParams.set('key', apiKey);
  return url;
}

function getGeminiTextDelta(parsed) {
  const parts = parsed?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .join('');
}

function describeGeminiIssue(error) {
  if (!getGeminiApiKey()) {
    return 'For full AI-powered responses, set GEMINI_API_KEY in .env, then restart the backend.';
  }

  if (!error) {
    return 'Gemini did not return a response for this message.';
  }

  const status = Number(error.status);

  if (status === 400) {
    return `Gemini rejected the request. Check GEMINI_MODEL in .env; the current model is "${GEMINI_MODEL}".`;
  }

  if (status === 401 || status === 403) {
    return 'Gemini rejected the API key. Make sure GEMINI_API_KEY is valid and the Generative Language API is enabled for that Google Cloud project.';
  }

  if (status === 404) {
    return `Gemini could not find the configured model "${GEMINI_MODEL}". Set GEMINI_MODEL to a model available to your key, then restart the backend.`;
  }

  if (status === 429 || String(error.message).includes('429')) {
    return `Gemini is connected, but Google returned a quota or rate-limit error for "${GEMINI_MODEL}". Wait for quota to reset, enable billing or use a key with available Gemini quota, or switch GEMINI_MODEL to a model with available quota.`;
  }

  if (status === 503) {
    return 'Gemini is temporarily overloaded. Try again in a moment.';
  }

  return 'Gemini is configured, but the request failed. Check backend.err.log for details.';
}

function describeLocalAiIssue(error) {
  if (LOCAL_AI_PROVIDER !== 'ollama') {
    return `Local AI provider "${LOCAL_AI_PROVIDER}" is not supported yet. Set LOCAL_AI_PROVIDER=ollama in .env.`;
  }

  if (!OLLAMA_BASE_URL || !OLLAMA_MODEL) {
    return `Local AI mode is enabled but OLLAMA_BASE_URL or OLLAMA_MODEL is not set in .env.`;
  }

  if (!error) {
    return `Local AI mode is enabled. Start Ollama and make sure the ${OLLAMA_MODEL} model is installed.`;
  }

  if (error.status === 404) {
    return `Local AI mode is enabled, but Ollama could not find the ${OLLAMA_MODEL} model. Run: ollama pull ${OLLAMA_MODEL}`;
  }

  if (
    error.status === 401 ||
    error.status === 403 ||
    String(error.message).toLowerCase().includes('subscription') ||
    String(error.message).toLowerCase().includes('upgrade')
  ) {
    return `Nex is connected to Ollama, but ${OLLAMA_MODEL} requires an Ollama subscription. Upgrade at https://ollama.com/upgrade or switch OLLAMA_MODEL to a local model.`;
  }

  return `Local AI mode is enabled, but Nex could not connect to Ollama at ${OLLAMA_BASE_URL}. Start Ollama, then run: ollama pull ${OLLAMA_MODEL}`;
}

function generateSearchSummary(query, results, searchError, geminiError) {
  if (!results.length) {
    const googleIssue = describeGoogleSearchIssue(searchError);
    const geminiIssue = geminiError ? `\n\n${describeGeminiIssue(geminiError)}` : '';
    return `${googleIssue}${geminiIssue}`;
  }

  const resultLines = results
    .map((result, index) => `${index + 1}. ${result.title}\n${result.snippet}\n${result.link}`)
    .join('\n\n');

  return `I found these Google results for "${query}":\n\n${resultLines}`;
}

function convertToGeminiContents(messages) {
  return messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
}

function buildSystemInstruction(firstName, searchResults = []) {
  const nameContext = firstName
    ? ` The user's first name is ${firstName}; use it naturally when it helps.`
    : '';
  const searchContext = searchResults.length
    ? `\n\nUse these search results as source context when relevant:\n\n${formatSearchResults(searchResults)}`
    : '';

  return `You are Nex, a helpful, concise AI assistant created by Raphael Lucky Uke. If asked who created, made, or built you, say that Raphael Lucky Uke created you. Answer clearly and be honest about uncertainty. If you do not know something or the question needs live information you cannot access, say so and ask for details or sources.${nameContext}${searchContext}`;
}

function convertToOllamaMessages(messages, firstName, searchResults = []) {
  return [
    {
      role: 'system',
      content: buildSystemInstruction(firstName, searchResults),
    },
    ...messages
      .filter(message => ['user', 'assistant', 'system'].includes(message.role))
      .map(message => ({
        role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
        content: String(message.content || ''),
      })),
  ];
}

async function streamOllamaResponse(res, messages, firstName, searchResults = []) {
  const response = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: convertToOllamaMessages(messages, firstName, searchResults),
      stream: true,
      options: {
        temperature: 0.6,
        num_predict: 1024,
        num_ctx: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Ollama API error: ${response.status} - ${errorText}`);
    error.status = response.status;
    throw error;
  }

  if (!response.body) {
    throw new Error('Ollama response did not include a stream.');
  }

  let assistantContent = '';
  let buffer = '';

  for await (const chunk of response.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line);
        const delta = parsed.message?.content || parsed.response || '';
        if (delta) {
          assistantContent += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      } catch {
        // Ignore partial JSON lines between chunks.
      }
    }
  }

  return assistantContent;
}

async function streamFallback(res, content) {
  const CHUNK_SIZE = 24;
  for (let i = 0; i < content.length; i += CHUNK_SIZE) {
    const delta = content.slice(i, i + CHUNK_SIZE);
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  }
  res.end('data: [DONE]\n\n');
}

function saveAssistantMessage(supabase, conversationId, content) {
  Promise.all([
    supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content,
    }),
    supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId),
  ]).catch(error => console.error('DB write error:', error));
}

async function handleChat(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    sendJson(res, 500, { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    sendJson(res, 401, { error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const [authResult, body] = await Promise.all([
    supabase.auth.getUser(token),
    readBody(req),
  ]);

  const {
    data: { user },
    error: authError,
  } = authResult;

  if (authError || !user) {
    sendJson(res, 401, { error: 'Invalid or expired token' });
    return;
  }

  const { messages, conversationId } = JSON.parse(body || '{}');

  if (!messages || !Array.isArray(messages)) {
    sendJson(res, 400, { error: 'messages array is required' });
    return;
  }

  const parallelChecks = [
    supabase.from('profiles').select('first_name').eq('id', user.id).maybeSingle(),
  ];

  if (conversationId) {
    parallelChecks.push(
      supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle(),
    );
  }

  const checkResults = await Promise.all(parallelChecks);
  const profile = checkResults[0].data;

  if (conversationId) {
    const conversation = checkResults[1]?.data;
    if (!conversation) {
      sendJson(res, 403, { error: 'Conversation does not belong to this user' });
      return;
    }
  }

  res.writeHead(200, {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let assistantContent = '';
  const firstName = profile?.first_name || '';
  const trimmedMessages = messages.slice(-10);
  const geminiApiKey = getGeminiApiKey();
  const latestUserMessage = [...trimmedMessages].reverse().find(message => message.role === 'user')?.content || '';
  let searchResults = [];
  let searchError = null;
  let localAiError = null;
  let geminiError = null;
  const searchedGoogle = ENABLE_GOOGLE_SEARCH && shouldSearchGoogle(latestUserMessage);

  // ── Step 1: Google Search (if enabled) ──────────────────────────────────────
  if (searchedGoogle) {
    try {
      searchResults = await searchGoogle(latestUserMessage);
    } catch (error) {
      searchError = error;
      console.error('Google Search failed:', error);
    }
  }

  // ── Step 2: Gemini (if ENABLE_EXTERNAL_AI=true) ──────────────────────────────
  // FIX: Gemini now runs FIRST when ENABLE_EXTERNAL_AI is true,
  // skipping Ollama entirely to avoid RAM errors on low-spec machines.
  if (!assistantContent && ENABLE_EXTERNAL_AI && geminiApiKey) {
    try {
      const response = await fetch(buildGeminiUrl(geminiApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: buildSystemInstruction(firstName, searchResults) }],
          },
          contents: convertToGeminiContents(trimmedMessages),
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.6,
            topK: 40,
            topP: 0.92,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw createGeminiError(response.status, errorText);
      }

      if (!response.body) {
        throw new Error('Gemini API response did not include a stream.');
      }

      let buffer = '';

      for await (const chunk of response.body) {
        buffer += Buffer.from(chunk).toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = getGeminiTextDelta(parsed);
            if (delta) {
              assistantContent += delta;
              res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
          } catch {
            // Ignore malformed stream chunks.
          }
        }
      }
    } catch (error) {
      geminiError = error;
      console.error('Gemini API failed, falling back:', error);
    }
  }

  // ── Step 3: Ollama (only if external AI is disabled) ─────────────────────────
  // FIX: Ollama only runs when ENABLE_EXTERNAL_AI=false and
  // OLLAMA_BASE_URL + OLLAMA_MODEL are both set.
  if (!assistantContent && !ENABLE_EXTERNAL_AI && LOCAL_AI_PROVIDER === 'ollama' && OLLAMA_BASE_URL && OLLAMA_MODEL) {
    try {
      assistantContent = await streamOllamaResponse(res, trimmedMessages, firstName, searchResults);
    } catch (error) {
      localAiError = error;
      console.error('Local Ollama failed, falling back:', error);
    }
  }

  // ── Step 4: Fallback ─────────────────────────────────────────────────────────
  if (!assistantContent) {
    assistantContent = searchResults.length || searchedGoogle
      ? generateSearchSummary(latestUserMessage, searchResults, searchError, geminiError)
      : isSimpleGreeting(latestUserMessage)
        ? generateFallbackResponse(trimmedMessages, firstName)
        : ENABLE_EXTERNAL_AI
          ? describeGeminiIssue(geminiError)
          : describeLocalAiIssue(localAiError);
    await streamFallback(res, assistantContent);
  } else {
    res.write('data: [DONE]\n\n');
    res.end();
  }

  if (conversationId && assistantContent) {
    saveAssistantMessage(supabase, conversationId, assistantContent);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/functions/v1/nex-chat') {
    try {
      await handleChat(req, res);
    } catch (error) {
      console.error('Nex chat error:', error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Internal server error', details: String(error) });
      } else {
        res.end();
      }
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Local Nex backend listening on http://0.0.0.0:${PORT}`);
  console.log(`External AI (Gemini): ${ENABLE_EXTERNAL_AI ? '✅ enabled' : '❌ disabled'}`);
  console.log(`Local AI (Ollama):    ${!ENABLE_EXTERNAL_AI && OLLAMA_BASE_URL ? '✅ enabled' : '❌ disabled'}`);
  console.log(`Google Search:        ${ENABLE_GOOGLE_SEARCH ? '✅ enabled' : '❌ disabled'}`);
});

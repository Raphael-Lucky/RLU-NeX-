import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  const envText = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[match[1]] = value;
  }

  return env;
}

async function main() {
  const env = { ...loadEnvFile(envPath), ...process.env };
  const apiKey = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_API_KEY;
  const model = env.GEMINI_MODEL || 'gemini-2.0-flash';

  if (!apiKey) {
    console.error('Gemini key: missing. Add GEMINI_API_KEY to .env.');
    return 1;
  }

  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: 'Reply with exactly: Gemini OK' }],
      }],
      generationConfig: {
        maxOutputTokens: 16,
        temperature: 0,
      },
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    let message = responseText;
    try {
      const parsed = JSON.parse(responseText);
      message = `${parsed.error?.status || 'ERROR'}: ${parsed.error?.message || 'No message'}`;
    } catch {
      // Keep the raw response text.
    }

    console.error(`Gemini check failed with HTTP ${response.status}.`);
    console.error(message.replaceAll(apiKey, '<redacted>'));
    return 1;
  }

  const parsed = JSON.parse(responseText);
  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '<empty>';
  console.log(`Gemini check passed for ${model}: ${text.trim()}`);
  return 0;
}

process.exitCode = await main();

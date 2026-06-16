import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

let geminiModelCache: string | null = null;

export type GeminiGenerateOpts = {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  /** Explicit model list (models/ prefix added if missing). */
  models?: string[];
  /** Env key for comma-separated model list, e.g. GEMINI_MODEL or GEMINI_MODEL_LESSONS. */
  modelsEnvKey?: string;
};

function geminiKey(config: ConfigService) {
  const k = (config.get<string>('GEMINI_API_KEY') || '').trim();
  if (!k) throw new BadRequestException('AI is not configured (missing GEMINI_API_KEY)');
  return k;
}

function normalizeModelNames(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((m) => (m.startsWith('models/') ? m : `models/${m}`));
}

function modelsFromEnv(config: ConfigService, envKey: string): string[] {
  const raw = (config.get<string>(envKey) || '').trim();
  if (!raw) return [];
  return normalizeModelNames(raw);
}

/** Default chain for CBT, practical AI, quick drafts (GEMINI_MODEL). */
export function preferredGeminiModels(config: ConfigService): string[] {
  return modelsFromEnv(config, 'GEMINI_MODEL');
}

/** Deeper lesson handouts/guides: GEMINI_MODEL_LESSONS, else flash-before-lite from GEMINI_MODEL. */
export function preferredLessonGeminiModels(config: ConfigService): string[] {
  const lessons = modelsFromEnv(config, 'GEMINI_MODEL_LESSONS');
  if (lessons.length) return lessons;

  const general = preferredGeminiModels(config);
  if (!general.length) return [];

  const nonLite = general.filter((m) => !/lite/i.test(m));
  return nonLite.length ? nonLite : general;
}

async function resolveGeminiModelName(config: ConfigService): Promise<string> {
  const overrides = preferredGeminiModels(config);
  if (overrides.length) return overrides[0];
  if (geminiModelCache) return geminiModelCache;

  const key = geminiKey(config);
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BadRequestException(data?.error?.message || 'Gemini ListModels failed');
  }

  const models: any[] = Array.isArray(data?.models) ? data.models : [];
  const supportsGenerate = (m: any) =>
    Array.isArray(m?.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes('generateContent') &&
    typeof m?.name === 'string';

  const preferred =
    models.find((m) => supportsGenerate(m) && /flash/i.test(String(m.name))) ||
    models.find((m) => supportsGenerate(m) && /gemini/i.test(String(m.name))) ||
    models.find((m) => supportsGenerate(m));

  const name = preferred?.name;
  if (!name) throw new BadRequestException('No Gemini model supports generateContent for this API key');

  geminiModelCache = name;
  return name;
}

function isRetryableGeminiError(status: number, message: string) {
  const msg = (message || '').toLowerCase();
  return status === 429 || status === 503 || msg.includes('high demand') || msg.includes('resource exhausted');
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function resolveModelsToTry(config: ConfigService, opts?: GeminiGenerateOpts): Promise<string[]> {
  if (opts?.models?.length) {
    return opts.models.map((m) => (m.startsWith('models/') ? m : `models/${m}`));
  }
  if (opts?.modelsEnvKey) {
    const fromEnv = modelsFromEnv(config, opts.modelsEnvKey);
    if (fromEnv.length) return fromEnv;
  }
  const general = preferredGeminiModels(config);
  return general.length ? general : [await resolveGeminiModelName(config)];
}

/**
 * Core Gemini generateContent call with model fallback + retries.
 */
export async function geminiGenerate(
  config: ConfigService,
  prompt: string,
  opts?: GeminiGenerateOpts,
): Promise<{ text: string; modelUsed: string }> {
  const key = geminiKey(config);
  const modelsToTry = await resolveModelsToTry(config, opts);
  const mimeType = opts?.responseMimeType ?? 'text/plain';

  const generationConfig: Record<string, unknown> = {
    temperature: typeof opts?.temperature === 'number' ? opts.temperature : 0.35,
  };
  if (mimeType === 'application/json') {
    generationConfig.responseMimeType = 'application/json';
  }
  if (typeof opts?.maxOutputTokens === 'number' && opts.maxOutputTokens > 0) {
    generationConfig.maxOutputTokens = opts.maxOutputTokens;
  }

  const body = JSON.stringify({
    generationConfig,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  let lastErr: any = null;
  for (let mi = 0; mi < modelsToTry.length; mi++) {
    const modelName = modelsToTry[mi];
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new BadRequestException('Gemini returned empty response');
        return { text: String(text).trim(), modelUsed: modelName };
      }

      const msg = data?.error?.message || 'Gemini request failed';
      lastErr = { status: res.status, msg, modelName };
      if (!isRetryableGeminiError(res.status, msg)) {
        break;
      }
      const delay = attempt === 0 ? 800 : attempt === 1 ? 1600 : 3000;
      await sleep(delay);
    }
  }

  throw new BadRequestException(
    lastErr?.msg
      ? `Gemini failed after retries (last model ${lastErr.modelName}): ${lastErr.msg}`
      : 'Gemini request failed after retries',
  );
}

export type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function toApiParts(parts: GeminiContentPart[]) {
  return parts.map((p) => {
    if ('text' in p) return { text: p.text };
    return { inline_data: { mime_type: p.inlineData.mimeType, data: p.inlineData.data } };
  });
}

/** Multimodal generateContent — images, PDFs, etc. */
export async function geminiGenerateMultimodal(
  config: ConfigService,
  parts: GeminiContentPart[],
  opts?: GeminiGenerateOpts,
): Promise<{ text: string; modelUsed: string }> {
  const key = geminiKey(config);
  const modelsToTry = await resolveModelsToTry(config, opts);
  const mimeType = opts?.responseMimeType ?? 'text/plain';

  const generationConfig: Record<string, unknown> = {
    temperature: typeof opts?.temperature === 'number' ? opts.temperature : 0.25,
  };
  if (mimeType === 'application/json') {
    generationConfig.responseMimeType = 'application/json';
  }
  if (typeof opts?.maxOutputTokens === 'number' && opts.maxOutputTokens > 0) {
    generationConfig.maxOutputTokens = opts.maxOutputTokens;
  }

  const body = JSON.stringify({
    generationConfig,
    contents: [{ role: 'user', parts: toApiParts(parts) }],
  });

  let lastErr: any = null;
  for (let mi = 0; mi < modelsToTry.length; mi++) {
    const modelName = modelsToTry[mi];
    for (let attempt = 0; attempt < 3; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new BadRequestException('Gemini returned empty vision response');
        return { text: String(text).trim(), modelUsed: modelName };
      }

      const msg = data?.error?.message || 'Gemini request failed';
      lastErr = { status: res.status, msg, modelName };
      if (!isRetryableGeminiError(res.status, msg)) {
        break;
      }
      const delay = attempt === 0 ? 800 : attempt === 1 ? 1600 : 3000;
      await sleep(delay);
    }
  }

  throw new BadRequestException(
    lastErr?.msg
      ? `Gemini vision failed (last model ${lastErr.modelName}): ${lastErr.msg}`
      : 'Gemini vision request failed after retries',
  );
}

/** Plain-text / Markdown generation (long-form lesson handouts, teacher guides). */
export async function geminiGenerateText(
  config: ConfigService,
  prompt: string,
  opts?: GeminiGenerateOpts,
): Promise<{ text: string; modelUsed: string }> {
  return geminiGenerate(config, prompt, { ...opts, responseMimeType: 'text/plain' });
}

/**
 * JSON response type. Shared by CBT, practical AI, lesson slides/practice.
 */
export async function geminiGenerateJson(
  config: ConfigService,
  prompt: string,
  opts?: GeminiGenerateOpts,
): Promise<{ jsonText: string; modelUsed: string }> {
  const { text, modelUsed } = await geminiGenerate(config, prompt, {
    ...opts,
    responseMimeType: 'application/json',
  });
  return { jsonText: text, modelUsed };
}

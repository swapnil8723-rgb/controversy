// AI provider for the daily pipeline. Free by default: Google AI Studio's free tier
// (gemini-2.5-flash, falling back to gemini-2.5-flash-lite when the daily quota or capacity
// runs out). Set GEMINI_API_KEY as a GitHub Actions secret. ANTHROPIC_API_KEY also works.
// Pattern taken from the Protest pipeline, which runs this way in production.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OverBudget extends Error {}

/** Pull the first JSON value out of a model reply. */
export function parseJson<T>(text: string): T {
  const s = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    const start = s.search(/[[{]/);
    const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1)) as T;
    throw new Error('AI reply was not JSON');
  }
}

export interface Ai {
  available: boolean;
  calls: number;
  json<T>(system: string, prompt: string, schema: object): Promise<T>;
}

export function makeAi(opts: { maxCalls: number; deadline: number }): Ai {
  const gemKey = process.env.GEMINI_API_KEY;
  const antKey = process.env.ANTHROPIC_API_KEY;
  const provider = (process.env.AI_PROVIDER || (gemKey ? 'gemini' : antKey ? 'anthropic' : 'none')).toLowerCase();
  const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', ...(process.env.GEMINI_FALLBACK || 'gemini-2.5-flash-lite').split(',').filter(Boolean)];
  let last = 0;
  const pace = async (ms: number) => {
    const wait = last + ms - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };

  const gemini = async (system: string, prompt: string, schema: object) => {
    for (let attempt = 0; ; attempt++) {
      if (Date.now() > opts.deadline) throw new OverBudget('run time limit reached');
      await pace(6500); // free tier is about 10 requests a minute on Flash
      const model = models[0];
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': gemKey! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseJsonSchema: schema },
        }),
        signal: AbortSignal.timeout(120000),
      });
      const body: any = await res.json().catch(() => ({}));
      const msg = String(body?.error?.message ?? '');
      const outOfQuota = res.status === 429 && /per ?day|daily|PerDay/i.test(msg + JSON.stringify(body?.error?.details ?? ''));
      if ((res.status === 404 || outOfQuota || (res.status >= 500 && attempt >= 1) || (res.status === 429 && attempt >= 3)) && models.length > 1) {
        console.warn(`gemini: ${model} unavailable (${res.status}), switching to ${models[1]}`);
        models.shift();
        attempt = -1;
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(15000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`gemini ${res.status}: ${msg}`.slice(0, 300));
      return parseJson(body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '');
    }
  };

  const anthropic = async (system: string, prompt: string, schema: object) => {
    for (let attempt = 0; ; attempt++) {
      await pace(500);
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': antKey!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
          max_tokens: 8000,
          temperature: 0.2,
          system,
          messages: [{ role: 'user', content: `${prompt}\n\nReply with only a JSON value matching this JSON Schema, no prose:\n${JSON.stringify(schema)}` }],
        }),
        signal: AbortSignal.timeout(120000),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(10000 * (attempt + 1));
        continue;
      }
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${body?.error?.message ?? ''}`.slice(0, 300));
      return parseJson(body.content?.map((c: any) => c.text ?? '').join('') ?? '');
    }
  };

  const ai: Ai = {
    available: provider === 'gemini' || provider === 'anthropic',
    calls: 0,
    async json<T>(system: string, prompt: string, schema: object) {
      if (ai.calls >= opts.maxCalls) throw new OverBudget(`AI call cap ${opts.maxCalls} reached`);
      ai.calls++;
      if (provider === 'gemini') return (await gemini(system, prompt, schema)) as T;
      if (provider === 'anthropic') return (await anthropic(system, prompt, schema)) as T;
      throw new Error('No AI key configured');
    },
  };
  return ai;
}

/**
 * One-off: compare Gemini models for lesson material depth.
 * Run: pnpm exec ts-node scripts/test-learning-material-ai.ts
 */
import 'dotenv/config';

const KEY = (process.env.GEMINI_API_KEY || '').trim();
const MODELS = ['models/gemini-2.5-flash-lite', 'models/gemini-2.5-flash', 'models/gemini-2.5-pro'];

const module = {
  id: 'test',
  title: 'HTML Fundamentals',
  number: 1,
  description: 'Introduction to HTML structure, tags, and basic web pages.',
  objectives: [
    'Explain what HTML is and its role in web development',
    'Create a basic HTML document with head and body',
    'Use common tags: headings, paragraphs, lists, links, images',
    'Understand semantic structure and accessibility basics',
  ],
  track: 'TRACK_1',
};

const lesson = {
  id: 'lesson-1',
  title: 'Introduction to HTML',
  position: 1,
  objective: 'Students understand HTML as markup and build a first page.',
  outline: [
    { section: 'What is HTML?', points: ['Markup language', 'Browser renders tags', 'Not programming'] },
    { section: 'Document structure', points: ['<!DOCTYPE html>', '<html>', '<head>', '<body>'] },
  ],
  exercises: ['Create a page with h1 and p', 'Add an unordered list'],
  quickCheckQuestions: ['What does HTML stand for?', 'Which tag wraps visible content?'],
  resources: [{ label: 'MDN HTML intro', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' }],
};

function buildPrompt() {
  return [
    `You are writing a complete, teachable lesson material pack for Nigerian secondary-school ICT / programming classes.`,
    `Return ONLY valid JSON with this exact shape (no markdown fences in JSON):`,
    `{"sessionTitle":string,` +
      `"teacherGuideMarkdown":string,` +
      `"studentHandoutMarkdown":string,` +
      `"practice":{"classwork":string[],"homework":string[],"answers":string[]},` +
      `"slides":[{"title":string,"bullets":string[]}]} `,
    ``,
    `Quality requirements:`,
    `- teacherGuideMarkdown MUST be detailed enough for a tutor to teach from (minute-by-minute flow, what to say/do, demos, common mistakes, checks for understanding).`,
    `- studentHandoutMarkdown MUST be detailed enough for a student to revise from (definitions, key points, 2+ worked examples, and short recap).`,
    `- practice: at least 5 classwork items, 3 homework items, and an answer key covering the practice (answers can be brief but correct).`,
    `- Include runnable code snippets where relevant (use fenced code blocks inside the markdown strings only, e.g. \`\`\`html and \`\`\`css).`,
    `- slides: 6–12 slides; each slide 3–6 bullets; keep bullets short (slide-appropriate).`,
    `- Align with module objectives and (if provided) the linked curriculum lesson.`,
    `- Use simple English, but do not oversimplify technical terms.`,
    ``,
    `Module context:`,
    JSON.stringify(module),
    `\nLinked curriculum lesson:\n${JSON.stringify(lesson)}\n`,
  ].join('\n');
}

async function callModel(modelName: string, prompt: string, temperature: number) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${encodeURIComponent(KEY)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: { temperature, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('empty response');
  try {
    return JSON.parse(text);
  } catch (e: any) {
    console.log(`  RAW response length: ${text.length}`);
    console.log(`  RAW tail: ...${text.slice(-200)}`);
    throw e;
  }
}

function report(model: string, parsed: any) {
  const tg = String(parsed?.teacherGuideMarkdown || '');
  const sh = String(parsed?.studentHandoutMarkdown || '');
  const slides = Array.isArray(parsed?.slides) ? parsed.slides : [];
  const cw = parsed?.practice?.classwork?.length ?? 0;
  console.log(`\n=== ${model} ===`);
  console.log(`  teacherGuide: ${tg.length} chars`);
  console.log(`  studentHandout: ${sh.length} chars`);
  console.log(`  slides: ${slides.length}`);
  console.log(`  classwork items: ${cw}`);
  console.log(`  studentHandout preview (first 600 chars):`);
  console.log(sh.slice(0, 600).replace(/\n/g, '\n  '));
  console.log('  ...');
}

async function main() {
  if (!KEY) {
    console.error('GEMINI_API_KEY missing');
    process.exit(1);
  }
  const prompt = buildPrompt();
  console.log(`Prompt length: ${prompt.length} chars`);
  for (const model of MODELS) {
    try {
      const parsed = await callModel(model, prompt, 0.4);
      report(model, parsed);
    } catch (e: any) {
      console.log(`\n=== ${model} === FAILED: ${e?.message || e}`);
    }
  }
}

main();

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const SYSTEM_INSTRUCTION = `You are NoteWise AI, an academic meeting and lecture notes assistant.

Your job is to transform the user's raw transcript or notes into an accurate, useful study/work summary.

Do not invent facts. Keep names, dates, numbers, decisions, deadlines, and responsibilities faithful to the input.

If an item is unclear or missing, say so rather than guessing.

Return ONLY valid JSON with this exact shape:

{
  "summary": "A concise paragraph of 3-6 sentences.",
  "keyPoints": ["5-8 concise key points"],
  "actionItems": [
    {
      "task": "Specific action",
      "owner": "Person or Unassigned",
      "deadline": "Date/time or Not specified"
    }
  ],
  "importantTopics": ["3-6 topic labels"]
}

Action items should include only actions explicitly stated or strongly implied by the notes.

If there are no action items, return an empty array.`;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJson(text) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

function validateResult(result) {
  return {
    summary:
      cleanText(result?.summary) ||
      'No summary was generated.',

    keyPoints:
      Array.isArray(result?.keyPoints)
        ? result.keyPoints
            .map(cleanText)
            .filter(Boolean)
            .slice(0, 10)
        : [],

    actionItems:
      Array.isArray(result?.actionItems)
        ? result.actionItems
            .map((item) => ({
              task: cleanText(item?.task),
              owner: cleanText(item?.owner) || 'Unassigned',
              deadline:
                cleanText(item?.deadline) || 'Not specified'
            }))
            .filter((item) => item.task)
            .slice(0, 12)
        : [],

    importantTopics:
      Array.isArray(result?.importantTopics)
        ? result.importantTopics
            .map(cleanText)
            .filter(Boolean)
            .slice(0, 8)
        : []
  };
}

/*
  Check whether the Gemini error is a temporary 503.
*/
function isTemporary503(error) {
  return (
    error?.status === 503 ||
    error?.code === 503 ||
    String(error?.message || '').includes('503') ||
    String(error?.message || '').toLowerCase().includes('service unavailable')
  );
}

/*
  Check whether the Gemini error is a 429 quota/rate-limit error.
*/
function isQuotaError(error) {
  return (
    error?.status === 429 ||
    error?.code === 429 ||
    String(error?.message || '').includes('429') ||
    String(error?.message || '').toLowerCase().includes('quota exceeded') ||
    String(error?.message || '').toLowerCase().includes('resource_exhausted')
  );
}

/*
  Check whether the API key is invalid/missing.
*/
function isApiKeyError(error) {
  const message = String(error?.message || '').toLowerCase();

  return (
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('invalid_argument')
  );
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'NoteWise AI',
    aiConfigured: Boolean(ai),
    model: MODEL
  });
});

app.post('/api/summarize', async (req, res) => {
  try {
    const notes = cleanText(req.body?.notes);

    if (!notes) {
      return res.status(400).json({
        error: 'Please paste your meeting or lecture notes first.'
      });
    }

    if (notes.length < 40) {
      return res.status(400).json({
        error:
          'Please provide a little more text so the AI can create a useful summary.'
      });
    }

    if (notes.length > 50000) {
      return res.status(413).json({
        error:
          'Your notes are too long. Please keep them under 50,000 characters.'
      });
    }

    if (!ai) {
      return res.status(503).json({
        error:
          'Gemini API is not configured. Add GEMINI_API_KEY to your environment variables and restart the server.'
      });
    }

    const prompt = `${SYSTEM_INSTRUCTION}

USER NOTES:
${notes}`;

    let response;

    /*
      Retry only temporary 503 errors.
      Do NOT repeatedly retry quota errors.
    */
    const MAX_RETRIES = 3;
    let retries = 0;

    while (true) {
      try {
        response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        });

        break;

      } catch (err) {

        /*
          429 = quota/rate limit.
          Stop immediately instead of repeatedly sending requests.
        */
        if (isQuotaError(err)) {
          console.warn(
            '[Gemini API] 429 quota/rate limit reached. No additional retries.'
          );

          return res.status(429).json({
            error:
              'The Gemini AI quota has been reached. Please wait and try again later.'
          });
        }

        /*
          503 = temporary service problem.
          Retry with increasing delays.
        */
        if (isTemporary503(err) && retries < MAX_RETRIES) {
          retries++;

          const delay = 2000 * Math.pow(2, retries - 1);

          console.warn(
            `[Gemini API] 503 unavailable. Retry ${retries}/${MAX_RETRIES} in ${delay}ms...`
          );

          await new Promise((resolve) =>
            setTimeout(resolve, delay)
          );

          continue;
        }

        throw err;
      }
    }

    const result = validateResult(
      parseJson(response.text || '{}')
    );

    return res.json({
      result,
      model: MODEL
    });

  } catch (error) {
    console.error('Summarization error:', error);

    if (isQuotaError(error)) {
      return res.status(429).json({
        error:
          'The Gemini AI quota has been reached. Please wait and try again later.'
      });
    }

    if (isApiKeyError(error)) {
      return res.status(401).json({
        error:
          'The Gemini API key appears to be invalid or missing. Please check the GEMINI_API_KEY environment variable.'
      });
    }

    if (isTemporary503(error)) {
      return res.status(503).json({
        error:
          'The Gemini AI service is temporarily unavailable. Please wait a moment and try again.'
      });
    }

    return res.status(500).json({
      error:
        'The AI could not process these notes right now. Please try again.'
    });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `NoteWise AI running on http://localhost:${PORT}`
  );
});
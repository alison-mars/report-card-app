import axios from "axios";
import { parseAiJsonArray } from "./parseAiJson.ts";

function normalizeQuestionKey(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
}

export function extractQMarkers(text: string): string[] {
  const matches = text.match(/\bQ\.\s*\d{1,2}\b/gi);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\s+/g, "")))];
}

export function estimateQuestionsOnPage(text: string): number {
  const qMarkers = extractQMarkers(text);
  if (qMarkers.length > 0) return qMarkers.length;

  const trimmed = text.trim();
  if (!trimmed) return 1;

  const numbered = trimmed.match(/(?:^|[\n\r]|\s)(\d{1,2})[.)]\s+(?:Let|If|The|Consider|Match|Suppose|For\b)/gi);
  if (numbered && numbered.length > 0) return numbered.length;

  return 0;
}

const SYSTEM_PROMPT =
  "Parse exam pages into JSON. Use $...$ LaTeX for math. Return ONLY a JSON array — no markdown, no prose.";

export function buildPageInstruction(extractedText: string): string {
  const hasText = extractedText.trim().length > 50;
  const qMarkers = extractQMarkers(extractedText);
  const estimated = estimateQuestionsOnPage(extractedText);
  const textBlock = hasText
    ? `\n--- PDF TEXT ---\n${extractedText}\n--- END ---\n`
    : "";
  const markerList =
    qMarkers.length > 0
      ? ` This page has exactly these question markers: ${qMarkers.join(", ")}. Return one JSON object per marker.`
      : "";

  return (
    `Extract exactly ${estimated} question(s).${markerList} ` +
    "Each question must be a separate JSON array element. Do not merge questions. Do not skip any. " +
    "Each item: { question, questionType (objective|subjective), options (array, empty for subjective), hasDiagram (boolean) }." +
    textBlock +
    "Return ONLY the JSON array."
  );
}

type ExtractResult = {
  items: any[];
  rawContent: string;
  finishReason?: string;
};

export async function extractQuestionsFromPageImage(
  apiKey: string,
  dataUrl: string,
  extractedText: string,
  headers: Record<string, string>,
  logPrefix = "[pdfExtract]"
): Promise<ExtractResult> {
  const qMarkers = extractQMarkers(extractedText);
  const expectedMin = estimateQuestionsOnPage(extractedText);
  const model = "google/gemini-2.5-flash";

  if (expectedMin === 0) {
    return { items: [], rawContent: "[]" };
  }

  const call = async (userText: string): Promise<ExtractResult> => {
    const payload = {
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 8192,
    };

    const resp = await axios.post("https://openrouter.ai/api/v1/chat/completions", payload, { headers });
    const rawContent: string = resp?.data?.choices?.[0]?.message?.content || "[]";
    const finishReason: string | undefined = resp?.data?.choices?.[0]?.finish_reason;
    const items = parseAiJsonArray(rawContent);
    return { items, rawContent, finishReason };
  };

  let result = await call(buildPageInstruction(extractedText));
  console.log(
    `${logPrefix} pass 1: ${result.items.length}/${expectedMin} questions, finish=${result.finishReason}, len=${result.rawContent.length}`
  );

  if (result.items.length < expectedMin) {
    const retryHint =
      buildPageInstruction(extractedText) +
      `\n\nYou returned ${result.items.length} question(s) but there are ${expectedMin}. ` +
      `Return ALL ${expectedMin} questions as separate objects in the JSON array.`;
    const retry = await call(retryHint);
    console.log(
      `${logPrefix} pass 2: ${retry.items.length}/${expectedMin} questions, finish=${retry.finishReason}, len=${retry.rawContent.length}`
    );
    if (retry.items.length >= result.items.length) {
      result = retry;
    }
  }

  if (result.items.length < expectedMin && qMarkers.length > 0) {
    const merged = [...result.items];
    const seen = new Set(merged.map((item) => normalizeQuestionKey(String(item?.question || ""))));

    for (const marker of qMarkers) {
      const singleHint =
        `Extract ONLY ${marker} from this page image. ` +
        `Return a JSON array with exactly one object for ${marker}. ` +
        "Include question, questionType, options, hasDiagram.";
      const single = await call(singleHint);
      for (const item of single.items) {
        const key = normalizeQuestionKey(String(item?.question || ""));
        if (key && !seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
    }

    console.log(`${logPrefix} per-marker fallback: ${merged.length}/${expectedMin} questions`);
    if (merged.length > result.items.length) {
      result = { ...result, items: merged };
    }
  }

  return result;
}

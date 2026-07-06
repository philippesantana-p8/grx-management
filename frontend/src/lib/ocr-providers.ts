import { parseCnhOcrText, type CnhOcrResult } from "@/lib/cnh-ocr";

export type OcrEngine = "google-vision" | "tesseract";

export async function recognizeWithGoogleVision(
  buffer: Buffer,
  apiKey: string
): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: buffer.toString("base64") },
            imageContext: { languageHints: ["pt", "pt-BR"] },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Vision falhou (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }>;
  };

  const first = payload.responses?.[0];
  if (first?.error?.message) throw new Error(first.error.message);
  return first?.fullTextAnnotation?.text?.trim() ?? "";
}

export async function recognizeWithTesseractBuffer(buffer: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text?.trim() ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function recognizeDocumentBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; engine: OcrEngine }> {
  const googleKey = process.env.GOOGLE_VISION_API_KEY?.trim();

  if (googleKey && mimeType.startsWith("image/")) {
    try {
      const text = await recognizeWithGoogleVision(buffer, googleKey);
      if (text) return { text, engine: "google-vision" };
    } catch {
      // fallback para Tesseract
    }
  }

  const text = await recognizeWithTesseractBuffer(buffer);
  return { text, engine: "tesseract" };
}

export function buildOcrResult(text: string): CnhOcrResult {
  return parseCnhOcrText(text);
}

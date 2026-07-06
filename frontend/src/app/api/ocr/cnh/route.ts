import { NextResponse } from "next/server";
import { buildOcrResult, recognizeDocumentBuffer } from "@/lib/ocr-providers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Envie uma imagem (JPG, PNG ou WEBP). PDF deve ser convertido no navegador." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text, engine } = await recognizeDocumentBuffer(buffer, file.type);
  const result = buildOcrResult(text);

  return NextResponse.json({
    result,
    engine,
    hasGoogleVision: Boolean(process.env.GOOGLE_VISION_API_KEY?.trim()),
  });
}

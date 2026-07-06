export type CnhScanSide = "frente" | "verso" | "pdf-1" | "pdf-2";

export type CnhScanAsset = {
  file: File;
  previewUrl: string;
  side: CnhScanSide;
  label: string;
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function configurePdfWorker(pdfjs: typeof import("pdfjs-dist")) {
  if (typeof window === "undefined") return;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

async function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Não foi possível converter o PDF em imagem.");
  return new File([blob], name, { type: "image/jpeg" });
}

export async function pdfToImageFiles(file: File, maxPages = 2): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  configurePdfWorker(pdfjs);

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const images: File[] = [];

  for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas não suportado neste navegador.");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const baseName = file.name.replace(/\.pdf$/i, "") || "cnh";
    images.push(await canvasToFile(canvas, `${baseName}-pag${pageNumber}.jpg`));
  }

  return images;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_TYPES.has(file.type);
}

export function isSupportedCnhFile(file: File): boolean {
  return isImageFile(file) || isPdfFile(file);
}

/** Converte PDF em até 2 imagens; imagens retornam como arquivo único. */
export async function expandCnhInputFile(file: File): Promise<File[]> {
  if (isPdfFile(file)) return pdfToImageFiles(file, 2);
  if (!isImageFile(file)) {
    throw new Error("Formato não suportado. Use JPG, PNG, WEBP ou PDF.");
  }
  return [file];
}

export function sideLabel(side: CnhScanSide): string {
  switch (side) {
    case "frente":
      return "Frente";
    case "verso":
      return "Verso";
    case "pdf-1":
      return "PDF — página 1";
    case "pdf-2":
      return "PDF — página 2";
  }
}

export function buildScanAsset(file: File, side: CnhScanSide): CnhScanAsset {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    side,
    label: sideLabel(side),
  };
}

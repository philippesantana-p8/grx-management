"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  buildScanAsset,
  expandCnhInputFile,
  isPdfFile,
  type CnhScanAsset,
  type CnhScanSide,
} from "@/lib/cnh-document";
import {
  mergeCnhOcrResults,
  recognizeCnhImages,
  type CnhOcrResult,
  type OcrEngine,
} from "@/lib/cnh-ocr";

export type CnhScanPayload = {
  result: CnhOcrResult;
  assets: CnhScanAsset[];
  engine: OcrEngine;
};

type Props = {
  disabled?: boolean;
  onScanned: (payload: CnhScanPayload) => void;
};

type ScanGroup = {
  key: string;
  side: CnhScanSide;
  assets: CnhScanAsset[];
  result: CnhOcrResult;
  engine: OcrEngine;
};

export function CnhScanner({ disabled, onScanned }: Props) {
  const frenteRef = useRef<HTMLInputElement>(null);
  const versoRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ScanGroup[]>([]);

  const emitMerged = (nextGroups: ScanGroup[]) => {
    const merged = mergeCnhOcrResults(nextGroups.map((group) => group.result));
    const assets = nextGroups.flatMap((group) => group.assets);
    const engine = nextGroups.some((group) => group.engine === "google-vision")
      ? "google-vision"
      : "tesseract";

    onScanned({ result: merged, assets, engine });
  };

  const processFiles = async (files: File[], side: CnhScanSide) => {
    setLoading(true);
    setError(null);
    setProgress(side === "verso" ? "Processando verso da CNH..." : "Processando frente da CNH...");

    try {
      const expanded: File[] = [];
      for (const file of files) {
        expanded.push(...(await expandCnhInputFile(file)));
      }

      const assets = expanded.map((file, index) => {
        const assetSide: CnhScanSide =
          isPdfFile(files[0]) && expanded.length > 1
            ? index === 0
              ? "pdf-1"
              : "pdf-2"
            : side;
        return buildScanAsset(file, assetSide);
      });

      setProgress("Extraindo dados com OCR...");
      const { result, engine } = await recognizeCnhImages(expanded, setProgress);

      const group: ScanGroup = {
        key: `${side}-${Date.now()}`,
        side,
        assets,
        result,
        engine,
      };

      const nextGroups = [
        ...groups.filter((item) => item.side !== side && !item.side.startsWith("pdf")),
        group,
      ];
      setGroups(nextGroups);

      const merged = mergeCnhOcrResults(nextGroups.map((item) => item.result));
      if (merged.filledFields.length === 0) {
        setError(
          "Não foi possível identificar dados. Melhore a iluminação, enquadre a CNH inteira ou preencha manualmente."
        );
        return;
      }

      emitMerged(nextGroups);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao digitalizar a CNH.");
    } finally {
      setLoading(false);
    }
  };

  const handleInput = async (fileList: FileList | null, side: CnhScanSide) => {
    const file = fileList?.[0];
    if (!file) return;
    await processFiles([file], side);
  };

  const mergedPreview = mergeCnhOcrResults(groups.map((group) => group.result));
  const engine = groups.some((group) => group.engine === "google-vision")
    ? "google-vision"
    : groups.length
      ? "tesseract"
      : null;

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-800">Digitalizar CNH</p>
          <p className="text-xs text-slate-500">
            Frente + verso (opcional), câmera, galeria ou PDF. OCR via Google Vision quando configurado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={frenteRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleInput(e.target.files, "frente");
              e.target.value = "";
            }}
          />
          <input
            ref={versoRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              void handleInput(e.target.files, "verso");
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || loading}
            onClick={() => frenteRef.current?.click()}
          >
            {loading ? "Digitalizando..." : "Frente / PDF"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || loading}
            onClick={() => versoRef.current?.click()}
          >
            Verso
          </Button>
        </div>
      </div>

      {progress && <p className="text-xs text-slate-600">{progress}</p>}
      {engine && (
        <p className="text-xs text-slate-500">
          Motor OCR: {engine === "google-vision" ? "Google Vision" : "Tesseract (local)"}
        </p>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      {mergedPreview.filledFields.length > 0 && (
        <Alert variant="info">
          Campos detectados: {mergedPreview.filledFields.join(", ")}. Revise antes de salvar.
        </Alert>
      )}

      {groups.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.flatMap((group) =>
            group.assets.map((asset) => (
              <div key={`${group.key}-${asset.previewUrl}`} className="space-y-1">
                <p className="text-xs font-medium text-slate-600">{asset.label}</p>
                <img
                  src={asset.previewUrl}
                  alt={asset.label}
                  className="max-h-36 w-full rounded-md border border-slate-200 object-contain bg-white"
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

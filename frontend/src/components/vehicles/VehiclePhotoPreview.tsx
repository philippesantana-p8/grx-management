"use client";

import { useEffect, useState } from "react";
import { getVehiclePhotoUrl } from "@/lib/vehicle-photo";

type Props = {
  photoStoragePath: string | null | undefined;
  label?: string;
  className?: string;
  sizeClassName?: string;
};

/** Preview somente leitura (OS / voucher) — sem upload. */
export function VehiclePhotoPreview({
  photoStoragePath,
  label = "Foto do veículo",
  className = "",
  sizeClassName = "h-28 w-28",
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const signed = await getVehiclePhotoUrl(photoStoragePath);
      if (!cancelled) setUrl(signed);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoStoragePath]);

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${sizeClassName}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-xs text-slate-500">Sem foto</span>
        )}
      </div>
    </div>
  );
}

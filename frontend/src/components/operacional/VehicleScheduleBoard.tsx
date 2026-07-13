"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  computeFreeSlots,
  dayLabel,
  formatMinutes,
  serviceTypeColor,
  SCHEDULE_WORK_END_MIN,
  SCHEDULE_WORK_START_MIN,
  type ScheduleSegment,
} from "@/lib/vehicle-schedule";
import type { VehicleScheduleRow } from "@/lib/vehicle-schedule-api";
import { cn } from "@/lib/utils";

type Selection = {
  vehicleId: string;
  dayKey: string;
} | null;

type Props = {
  vehicles: VehicleScheduleRow[];
  segments: ScheduleSegment[];
  weekKeys: string[];
  selection: Selection;
  onSelect: (next: Selection) => void;
};

function segmentsForCell(
  segments: ScheduleSegment[],
  vehicleId: string,
  dayKey: string
): ScheduleSegment[] {
  return segments
    .filter((s) => s.vehicleId === vehicleId && s.dayKey === dayKey)
    .sort((a, b) => a.startMin - b.startMin);
}

export function VehicleScheduleBoard({
  vehicles,
  segments,
  weekKeys,
  selection,
  onSelect,
}: Props) {
  const selectedSegments = useMemo(() => {
    if (!selection) return [];
    return segmentsForCell(segments, selection.vehicleId, selection.dayKey);
  }, [segments, selection]);

  const freeSlots = useMemo(() => computeFreeSlots(selectedSegments), [selectedSegments]);

  const selectedVehicle = selection
    ? vehicles.find((v) => v.id === selection.vehicleId)
    : null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80 [-webkit-overflow-scrolling:touch]">
        <table className="min-w-[56rem] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className="sticky left-0 z-20 min-w-[8.5rem] bg-slate-50 px-3 py-3 text-left font-semibold text-slate-700">
                Veículo
              </th>
              {weekKeys.map((key) => {
                const { weekday, date } = dayLabel(key);
                return (
                  <th key={key} className="min-w-[9rem] px-2 py-3 text-center font-semibold text-slate-700">
                    <span className="block capitalize">{weekday}</span>
                    <span className="text-xs font-normal text-slate-500">{date}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Nenhum veículo ativo na frota.
                </td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b border-slate-100 align-top">
                  <td className="sticky left-0 z-10 bg-white px-3 py-3">
                    <p className="font-semibold text-slate-900">{vehicle.plate}</p>
                    <p className="text-xs text-slate-500">{vehicle.model || vehicle.vehicle_category}</p>
                  </td>
                  {weekKeys.map((dayKey) => {
                    const cellSegments = segmentsForCell(segments, vehicle.id, dayKey);
                    const isSelected =
                      selection?.vehicleId === vehicle.id && selection.dayKey === dayKey;
                    const free = computeFreeSlots(cellSegments);
                    const hasFree = free.some((s) => s.endMin - s.startMin >= 60);

                    return (
                      <td key={dayKey} className="px-1.5 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            onSelect(
                              isSelected ? null : { vehicleId: vehicle.id, dayKey }
                            )
                          }
                          className={cn(
                            "min-h-[5.5rem] w-full rounded-lg border p-1.5 text-left transition",
                            isSelected
                              ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-200"
                              : "border-slate-200/80 bg-slate-50/40 hover:border-brand-200 hover:bg-white"
                          )}
                        >
                          {cellSegments.length === 0 ? (
                            <span className="block px-1 py-2 text-xs text-emerald-700">
                              Livre (06:00–22:00)
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {cellSegments.map((seg) => (
                                <div
                                  key={`${seg.orderId}-${seg.dayKey}`}
                                  className={cn(
                                    "rounded-md border px-1.5 py-1 text-[0.68rem] leading-tight",
                                    serviceTypeColor(seg.serviceType)
                                  )}
                                >
                                  <span className="font-semibold">
                                    {formatMinutes(seg.startMin)}–{formatMinutes(seg.endMin)}
                                  </span>
                                  <span className="block truncate">{seg.orderCode}</span>
                                  {seg.clientName ? (
                                    <span className="block truncate opacity-80">{seg.clientName}</span>
                                  ) : null}
                                </div>
                              ))}
                              {hasFree ? (
                                <span className="block px-1 text-[0.65rem] text-emerald-700">
                                  + horários livres
                                </span>
                              ) : null}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selection && selectedVehicle ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {selectedVehicle.plate} · {dayLabel(selection.dayKey).weekday}{" "}
                {dayLabel(selection.dayKey).date}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Janela operacional {formatMinutes(SCHEDULE_WORK_START_MIN)}–
                {formatMinutes(SCHEDULE_WORK_END_MIN)}. Clique na célula para fechar.
              </p>
            </div>
            <Link
              href="/operacional/ordens-servico"
              className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              Abrir Ordens de Serviço
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section>
              <h4 className="text-sm font-semibold text-slate-800">Agendado (OS)</h4>
              {selectedSegments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Nenhuma OS neste dia.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedSegments.map((seg) => (
                    <li
                      key={seg.orderId}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        serviceTypeColor(seg.serviceType)
                      )}
                    >
                      <p className="font-semibold">
                        {seg.orderCode} · {formatMinutes(seg.startMin)}–{formatMinutes(seg.endMin)}
                      </p>
                      <p className="text-xs opacity-90">
                        {seg.serviceType}
                        {seg.clientName ? ` · ${seg.clientName}` : ""} · {seg.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-800">Horários disponíveis</h4>
              {freeSlots.length === 0 ? (
                <p className="mt-2 text-sm text-amber-800">Sem janela livre neste dia.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {freeSlots.map((slot, index) => (
                    <li
                      key={index}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900"
                    >
                      {formatMinutes(slot.startMin)} – {formatMinutes(slot.endMin)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="mt-4 hidden sm:block">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Linha do tempo (dia)</h4>
            <VehicleDayTimeline segments={selectedSegments} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Toque em um dia/placa para ver OS agendadas e horários livres (estilo agenda Teams).
        </p>
      )}
    </div>
  );
}

function VehicleDayTimeline({ segments }: { segments: ScheduleSegment[] }) {
  const total = SCHEDULE_WORK_END_MIN - SCHEDULE_WORK_START_MIN;

  return (
    <div className="relative h-12 rounded-lg border border-slate-200 bg-slate-100/80">
      {segments.map((seg) => {
        const left = ((seg.startMin - SCHEDULE_WORK_START_MIN) / total) * 100;
        const width = ((seg.endMin - seg.startMin) / total) * 100;
        return (
          <div
            key={seg.orderId}
            title={`${seg.orderCode} ${formatMinutes(seg.startMin)}–${formatMinutes(seg.endMin)}`}
            className={cn(
              "absolute top-1 bottom-1 rounded border px-1 text-[0.65rem] font-medium leading-tight overflow-hidden",
              serviceTypeColor(seg.serviceType)
            )}
            style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
          >
            {seg.orderCode}
          </div>
        );
      })}
      <div className="pointer-events-none absolute inset-x-0 -bottom-5 flex justify-between text-[0.65rem] text-slate-500">
        <span>06:00</span>
        <span>14:00</span>
        <span>22:00</span>
      </div>
    </div>
  );
}

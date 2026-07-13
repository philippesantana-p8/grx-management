import { OperacionalSubNav } from "@/components/operacional/OperacionalSubNav";

export default function OperacionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Operacional</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ordens de serviço, agenda da frota e infrações.
        </p>
      </div>
      <OperacionalSubNav />
      {children}
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { dataTableScroll } from "@/lib/liquid-glass-styles";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Coluna da esquerda fixa no scroll horizontal (ex.: OS, código). */
  stickyFirst?: boolean;
  /** Coluna da direita fixa (ex.: Ações). */
  stickyLast?: boolean;
  /** Override da altura máxima do quadro (CSS). */
  maxHeight?: string;
  className?: string;
  /** Texto curto acima do quadro (opcional). */
  hint?: ReactNode;
};

/**
 * Quadro de tabela com scroll próprio + cabeçalho sticky
 * (padrão Agenda da Frota / Rateio por OS — menu lateral não some).
 */
export function DataTableScroll({
  children,
  stickyFirst = false,
  stickyLast = false,
  maxHeight,
  className,
  hint,
}: Props) {
  const style: CSSProperties | undefined = maxHeight ? { maxHeight } : undefined;

  return (
    <div className="min-w-0 space-y-2">
      {hint ? <div className="text-xs text-slate-600">{hint}</div> : null}
      <div
        className={cn(dataTableScroll({ stickyFirst, stickyLast }), className)}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}

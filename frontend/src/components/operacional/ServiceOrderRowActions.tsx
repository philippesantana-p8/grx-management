"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isPendingClientProposal } from "@/lib/service-order-display-status";
import { registerProposalFollowUp } from "@/lib/service-order-proposal-api";
import { createClient } from "@/lib/supabase/client";
import type { ServiceOrderListRow } from "@/lib/service-order-filters";

type Props = {
  row: ServiceOrderListRow;
  onFollowUpRegistered?: (orderId: string, count: number, lastAt: string | null) => void;
};

export function ServiceOrderRowActions({ row, onFollowUpRegistered }: Props) {
  const [loading, setLoading] = useState(false);

  const canFollowUp = isPendingClientProposal(row);

  const handleFollowUp = async () => {
    setLoading(true);
    const supabase = createClient();
    const { count, lastAt, error } = await registerProposalFollowUp(supabase, row.id);
    setLoading(false);

    if (error) {
      window.alert(error);
      return;
    }

    onFollowUpRegistered?.(row.id, count, lastAt);
    window.alert(`Follow-up registrado (${count} contato${count === 1 ? "" : "s"}).`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/operacional/ordens-servico/${row.id}/proposta`}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        )}
      >
        PDF / Proposta
      </Link>
      {canFollowUp && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleFollowUp()}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
          )}
        >
          Registrar follow-up
        </button>
      )}
    </div>
  );
}

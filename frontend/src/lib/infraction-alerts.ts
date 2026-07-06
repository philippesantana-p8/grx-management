import type { TrafficInfraction } from "@/types/database";

export type InfractionAlertLevel = "info" | "warning" | "danger" | "success";

export type InfractionAlertId =
  | "archived"
  | "assign-driver"
  | "assignment-contested"
  | "indicate-authority"
  | "awaiting-authority"
  | "authority-refused"
  | "awaiting-payment-proof"
  | "validate-payment"
  | "ready-closure"
  | "ready-archive";

export type InfractionPendingFilter =
  | "all"
  | "pending_any"
  | "assign-driver"
  | "assignment-contested"
  | "indicate-authority"
  | "awaiting-authority"
  | "pending_authority"
  | "authority-refused"
  | "awaiting-payment-proof"
  | "validate-payment"
  | "ready-closure"
  | "ready-archive"
  | "ready_any"
  | "archived";

export type InfractionAlert = {
  id: InfractionAlertId;
  level: InfractionAlertLevel;
  label: string;
  detail?: string;
  footnote: string;
};

export type InfractionAlertSummary = {
  awaitingAuthority: number;
  authorityRefused: number;
  awaitingPaymentProof: number;
  paymentToValidate: number;
  readyForClosure: number;
  archived: number;
};

export type InfractionFilterOption = {
  value: InfractionPendingFilter;
  label: string;
  footnote: string;
};

export type InfractionRowForAlert = Pick<
  TrafficInfraction,
  | "driver_id"
  | "assignment_status"
  | "authority_status"
  | "payment_proof_status"
  | "case_status"
>;

const AUTHORITY_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  Indicado: "Indicado ao órgão",
  Aceito: "Aceito pelo órgão",
  Recusado: "Recusado pelo órgão",
};

const PAYMENT_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  Apresentado: "Comprovante apresentado",
  Validado: "Comprovante validado",
};

const CASE_LABELS: Record<string, string> = {
  EmAndamento: "Em andamento",
  Baixada: "Baixada",
  Arquivada: "Arquivada",
};

export const INFRACTION_ALERT_FOOTNOTES: Record<InfractionAlertId, string> = {
  "assign-driver":
    "Cruze a data da infração com a ordem de serviço ou indique o motorista manualmente antes de seguir.",
  "assignment-contested":
    "A indicação interna foi contestada — confira a OS, o lançamento financeiro e redefina o responsável.",
  "indicate-authority":
    "Com o motorista confirmado, registre a indicação no sistema do órgão autuador e atualize o status para Indicado.",
  "awaiting-authority":
    "Acompanhe o retorno do órgão autuador e atualize para Aceito ou Recusado conforme a resposta.",
  "authority-refused":
    "Se o órgão recusar o motorista, reavalie o responsável e envie nova indicação se necessário.",
  "awaiting-payment-proof":
    "Com a indicação aceita, solicite ao motorista o comprovante de pagamento da multa.",
  "validate-payment":
    "Anexe o comprovante, valide o documento e registre a baixa no sistema antes de arquivar.",
  "ready-closure":
    "Comprovante validado — registre a baixa financeira/operacional e marque o processo como Baixada.",
  "ready-archive":
    "Baixa concluída — arquive o processo para encerrar o acompanhamento.",
  archived: "Processo encerrado. Nenhuma ação pendente.",
};

export const INFRACTION_FILTER_OPTIONS: InfractionFilterOption[] = [
  {
    value: "all",
    label: "Todas as infrações",
    footnote: "Exibe todos os registros, independentemente do estágio do processo.",
  },
  {
    value: "pending_any",
    label: "Pendentes de regularização ou acompanhamento",
    footnote:
      "Reúne todas as infrações em aberto que exigem alguma ação sua — atribuição, órgão, comprovante ou baixa.",
  },
  {
    value: "assign-driver",
    label: "Atribuir motorista",
    footnote: INFRACTION_ALERT_FOOTNOTES["assign-driver"],
  },
  {
    value: "assignment-contested",
    label: "Atribuição contestada",
    footnote: INFRACTION_ALERT_FOOTNOTES["assignment-contested"],
  },
  {
    value: "indicate-authority",
    label: "Indicar ao órgão autuador",
    footnote: INFRACTION_ALERT_FOOTNOTES["indicate-authority"],
  },
  {
    value: "awaiting-authority",
    label: "Aguardando aceite do órgão",
    footnote: INFRACTION_ALERT_FOOTNOTES["awaiting-authority"],
  },
  {
    value: "pending_authority",
    label: "Pendências no órgão autuador",
    footnote:
      "Inclui infrações ainda não indicadas e as já indicadas aguardando resposta do órgão autuador.",
  },
  {
    value: "authority-refused",
    label: "Indicação recusada pelo órgão",
    footnote: INFRACTION_ALERT_FOOTNOTES["authority-refused"],
  },
  {
    value: "awaiting-payment-proof",
    label: "Aguardando comprovante do motorista",
    footnote: INFRACTION_ALERT_FOOTNOTES["awaiting-payment-proof"],
  },
  {
    value: "validate-payment",
    label: "Comprovante a validar / subir no sistema",
    footnote: INFRACTION_ALERT_FOOTNOTES["validate-payment"],
  },
  {
    value: "ready-closure",
    label: "Pronta para baixa",
    footnote: INFRACTION_ALERT_FOOTNOTES["ready-closure"],
  },
  {
    value: "ready-archive",
    label: "Pronta para arquivar",
    footnote: INFRACTION_ALERT_FOOTNOTES["ready-archive"],
  },
  {
    value: "ready_any",
    label: "Prontas para baixa ou arquivamento",
    footnote:
      "Infrações com comprovante validado aguardando baixa ou já baixadas aguardando arquivamento.",
  },
  {
    value: "archived",
    label: "Arquivadas",
    footnote: INFRACTION_ALERT_FOOTNOTES.archived,
  },
];

export function getAuthorityStatusLabel(status: string): string {
  return AUTHORITY_LABELS[status] ?? status;
}

export function getPaymentProofStatusLabel(status: string): string {
  return PAYMENT_LABELS[status] ?? status;
}

export function getCaseStatusLabel(status: string): string {
  return CASE_LABELS[status] ?? status;
}

export function getFilterOption(filter: InfractionPendingFilter): InfractionFilterOption {
  return (
    INFRACTION_FILTER_OPTIONS.find((option) => option.value === filter) ??
    INFRACTION_FILTER_OPTIONS[0]
  );
}

export function getInfractionAlerts(row: InfractionRowForAlert): InfractionAlert[] {
  if (row.case_status === "Arquivada") {
    return [
      {
        id: "archived",
        level: "success",
        label: "Arquivada",
        detail: "Processo concluído e arquivado.",
        footnote: INFRACTION_ALERT_FOOTNOTES.archived,
      },
    ];
  }

  const alerts: InfractionAlert[] = [];

  if (!row.driver_id || row.assignment_status === "Pendente") {
    alerts.push({
      id: "assign-driver",
      level: "warning",
      label: "Atribuir motorista",
      detail: "Defina o responsável antes de indicar ao órgão autuador.",
      footnote: INFRACTION_ALERT_FOOTNOTES["assign-driver"],
    });
  } else if (row.assignment_status === "Contestado") {
    alerts.push({
      id: "assignment-contested",
      level: "danger",
      label: "Atribuição contestada",
      detail: "Reavalie o responsável antes de seguir com o órgão autuador.",
      footnote: INFRACTION_ALERT_FOOTNOTES["assignment-contested"],
    });
  }

  if (
    row.authority_status === "Pendente" &&
    row.driver_id &&
    row.assignment_status === "Confirmado"
  ) {
    alerts.push({
      id: "indicate-authority",
      level: "warning",
      label: "Indicar ao órgão autuador",
      detail: "Envie a indicação do motorista e aguarde o retorno do órgão.",
      footnote: INFRACTION_ALERT_FOOTNOTES["indicate-authority"],
    });
  }

  if (row.authority_status === "Indicado") {
    alerts.push({
      id: "awaiting-authority",
      level: "warning",
      label: "Aguardando órgão autuador",
      detail: "Acompanhe se a indicação do motorista foi aceita.",
      footnote: INFRACTION_ALERT_FOOTNOTES["awaiting-authority"],
    });
  }

  if (row.authority_status === "Recusado") {
    alerts.push({
      id: "authority-refused",
      level: "danger",
      label: "Indicação recusada",
      detail: "O órgão autuador não aceitou o motorista indicado.",
      footnote: INFRACTION_ALERT_FOOTNOTES["authority-refused"],
    });
  }

  if (row.authority_status === "Aceito" && row.payment_proof_status === "Pendente") {
    alerts.push({
      id: "awaiting-payment-proof",
      level: "warning",
      label: "Aguardando comprovante",
      detail: "O motorista deve apresentar o comprovante de pagamento da multa.",
      footnote: INFRACTION_ALERT_FOOTNOTES["awaiting-payment-proof"],
    });
  }

  if (row.payment_proof_status === "Apresentado") {
    alerts.push({
      id: "validate-payment",
      level: "info",
      label: "Validar comprovante",
      detail: "Anexe/valide o comprovante, registre a baixa no sistema e arquive.",
      footnote: INFRACTION_ALERT_FOOTNOTES["validate-payment"],
    });
  }

  if (
    row.authority_status === "Aceito" &&
    row.payment_proof_status === "Validado" &&
    row.case_status === "EmAndamento"
  ) {
    alerts.push({
      id: "ready-closure",
      level: "success",
      label: "Pronta para baixa",
      detail: "Comprovante validado — realize a baixa e o arquivamento.",
      footnote: INFRACTION_ALERT_FOOTNOTES["ready-closure"],
    });
  }

  if (row.case_status === "Baixada") {
    alerts.push({
      id: "ready-archive",
      level: "info",
      label: "Pronta para arquivar",
      detail: "Baixa registrada — arquive o processo quando concluir.",
      footnote: INFRACTION_ALERT_FOOTNOTES["ready-archive"],
    });
  }

  return alerts;
}

export function rowHasInfractionAlert(row: InfractionRowForAlert, alertId: InfractionAlertId): boolean {
  return getInfractionAlerts(row).some((alert) => alert.id === alertId);
}

export function matchesInfractionFilter(
  row: InfractionRowForAlert,
  filter: InfractionPendingFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "archived") return row.case_status === "Arquivada";
  if (filter === "pending_any") {
    const alerts = getInfractionAlerts(row);
    return alerts.some((alert) => alert.id !== "archived");
  }
  if (filter === "ready_any") {
    return (
      rowHasInfractionAlert(row, "ready-closure") ||
      rowHasInfractionAlert(row, "ready-archive")
    );
  }
  if (filter === "pending_authority") {
    return (
      rowHasInfractionAlert(row, "indicate-authority") ||
      rowHasInfractionAlert(row, "awaiting-authority")
    );
  }

  return rowHasInfractionAlert(row, filter as InfractionAlertId);
}

export function summarizeInfractionAlerts(rows: InfractionRowForAlert[]): InfractionAlertSummary {
  let awaitingAuthority = 0;
  let authorityRefused = 0;
  let awaitingPaymentProof = 0;
  let paymentToValidate = 0;
  let readyForClosure = 0;
  let archived = 0;

  for (const row of rows) {
    if (row.case_status === "Arquivada") {
      archived += 1;
      continue;
    }

    if (
      rowHasInfractionAlert(row, "indicate-authority") ||
      rowHasInfractionAlert(row, "awaiting-authority")
    ) {
      awaitingAuthority += 1;
    }
    if (rowHasInfractionAlert(row, "authority-refused")) authorityRefused += 1;
    if (rowHasInfractionAlert(row, "awaiting-payment-proof")) awaitingPaymentProof += 1;
    if (rowHasInfractionAlert(row, "validate-payment")) paymentToValidate += 1;
    if (
      rowHasInfractionAlert(row, "ready-closure") ||
      rowHasInfractionAlert(row, "ready-archive")
    ) {
      readyForClosure += 1;
    }
  }

  return {
    awaitingAuthority,
    authorityRefused,
    awaitingPaymentProof,
    paymentToValidate,
    readyForClosure,
    archived,
  };
}

export function alertLevelToBadgeVariant(
  level: InfractionAlertLevel
): "default" | "success" | "warning" | "danger" {
  if (level === "success") return "success";
  if (level === "warning") return "warning";
  if (level === "danger") return "danger";
  return "default";
}
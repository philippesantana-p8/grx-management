/**
 * Agrupa linhas consecutivas (ou ordenadas) pela mesma chave
 * para evidenciar o mesmo bloco (OS, placa, quadro de sócios).
 */

export type RowGroup<T> = {
  key: string;
  rows: T[];
  /** true quando há 2+ linhas no grupo — desenhar retângulo. */
  multi: boolean;
};

/** Agrupa itens já ordenados pela chave. */
export function groupConsecutiveByKey<T>(
  items: T[],
  getKey: (item: T) => string | null | undefined
): RowGroup<T>[] {
  const groups: RowGroup<T>[] = [];
  for (const item of items) {
    const key = String(getKey(item) ?? "").trim() || "__empty__";
    const last = groups[groups.length - 1];
    if (last && last.key === key && key !== "__empty__") {
      last.rows.push(item);
      last.multi = last.rows.length > 1;
    } else {
      groups.push({ key, rows: [item], multi: false });
    }
  }
  return groups;
}

/** Ordena pela chave e agrupa (útil quando a lista não vem agrupada). */
export function groupByKeySorted<T>(
  items: T[],
  getKey: (item: T) => string | null | undefined,
  compareWithinGroup?: (a: T, b: T) => number
): RowGroup<T>[] {
  const sorted = [...items].sort((a, b) => {
    const ka = String(getKey(a) ?? "").trim();
    const kb = String(getKey(b) ?? "").trim();
    if (ka !== kb) return ka.localeCompare(kb, "pt-BR");
    return compareWithinGroup?.(a, b) ?? 0;
  });
  return groupConsecutiveByKey(sorted, getKey);
}

/** Classe CSS do retângulo de grupo (globals.css). */
export const DATA_ROW_GROUP_CLASS = "data-row-group";

/** Vão entre um quadro e o próximo (não encostar os retângulos). */
export const DATA_ROW_GROUP_GAP_CLASS = "data-row-group-gap";

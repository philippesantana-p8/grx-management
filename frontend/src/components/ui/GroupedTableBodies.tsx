"use client";

import { Fragment, type ReactNode } from "react";
import {
  DATA_ROW_GROUP_CLASS,
  DATA_ROW_GROUP_GAP_CLASS,
  type RowGroup,
} from "@/lib/table-row-groups";

type Props<T> = {
  groups: RowGroup<T>[];
  /** colSpan do spacer entre quadros. */
  colSpan: number;
  /**
   * `multi` = retângulo só com 2+ linhas (padrão).
   * `always` = cada grupo é um quadro (ex.: Rateio por OS).
   */
  frame?: "multi" | "always";
  children: (group: RowGroup<T>, groupIndex: number) => ReactNode;
};

function shouldFrame<T>(group: RowGroup<T>, frame: "multi" | "always"): boolean {
  return frame === "always" || group.multi;
}

/**
 * Renderiza vários <tbody> com retângulo azul (`data-row-group`) e vão entre quadros.
 */
export function GroupedTableBodies<T>({
  groups,
  colSpan,
  frame = "multi",
  children,
}: Props<T>) {
  return (
    <>
      {groups.map((group, groupIndex) => {
        const framed = shouldFrame(group, frame);
        const prevFramed =
          groupIndex > 0 ? shouldFrame(groups[groupIndex - 1]!, frame) : false;
        const showGap = groupIndex > 0 && (framed || prevFramed);

        return (
          <Fragment key={group.key}>
            {showGap ? (
              <tbody className={DATA_ROW_GROUP_GAP_CLASS} aria-hidden>
                <tr>
                  <td colSpan={colSpan} />
                </tr>
              </tbody>
            ) : null}
            <tbody className={framed ? DATA_ROW_GROUP_CLASS : undefined}>{children(group, groupIndex)}</tbody>
          </Fragment>
        );
      })}
    </>
  );
}

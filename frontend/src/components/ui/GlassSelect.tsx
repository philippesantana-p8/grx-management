"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { glassField } from "@/lib/liquid-glass-styles";

export type GlassSelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: GlassSelectOption[];
  label?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computeMenuPosition(trigger: HTMLButtonElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const gap = 4;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
  const spaceAbove = rect.top - gap - 12;
  const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(224, Math.max(120, preferBelow ? spaceBelow : spaceAbove));

  return {
    left: rect.left,
    width: rect.width,
    top: preferBelow ? rect.bottom + gap : rect.top - gap - maxHeight,
    maxHeight,
  };
}

export function GlassSelect({
  value,
  onChange,
  options,
  label,
  id,
  required,
  disabled,
  className,
  placeholder = "Selecione…",
  searchable,
}: Props) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 8;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => setMounted(true), []);

  const close = () => {
    setOpen(false);
    setQuery("");
    setMenu(null);
  };

  const openMenu = () => {
    if (disabled || !triggerRef.current) return;
    setMenu(computeMenuPosition(triggerRef.current));
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      if (!triggerRef.current) return;
      setMenu(computeMenuPosition(triggerRef.current));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-glass-select-menu]")) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menuNode =
    open && menu && mounted
      ? createPortal(
          <div
            data-glass-select-menu
            className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5"
            style={{
              position: "fixed",
              top: menu.top,
              left: menu.left,
              width: menu.width,
              zIndex: 9999,
            }}
          >
            {showSearch ? (
              <div className="border-b border-slate-100 p-2">
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar…"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/30"
                />
              </div>
            ) : null}
            <ul
              role="listbox"
              className="overflow-y-auto py-1"
              style={{ maxHeight: menu.maxHeight - (showSearch ? 52 : 0) }}
              aria-labelledby={selectId}
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">Nenhuma opção encontrada.</li>
              ) : (
                filtered.map((option) => (
                  <li key={option.value || "__empty__"} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                        option.value === value && "bg-brand-50 font-medium text-brand-800"
                      )}
                      onClick={() => {
                        onChange(option.value);
                        close();
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn("relative space-y-1", className)}>
      {label ? (
        <span className="block text-sm font-medium text-slate-700">{label}</span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          glassField(),
          "flex w-full items-center justify-between gap-2 text-left",
          disabled && "cursor-not-allowed opacity-60",
          open && "border-brand-600/45 ring-2 ring-brand-600/15"
        )}
        onClick={() => (open ? close() : openMenu())}
      >
        <span className={cn("truncate", !selected?.label && "text-slate-500")}>
          {selected?.label ?? placeholder}
        </span>
        <span className={cn("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden>
          ▾
        </span>
      </button>

      {required ? <input type="text" tabIndex={-1} className="sr-only" value={value} required readOnly aria-hidden /> : null}

      {menuNode}
    </div>
  );
}

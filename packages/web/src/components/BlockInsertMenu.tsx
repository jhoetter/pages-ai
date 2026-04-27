import { type SlashCommandDef } from "@pagesai/core";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useRef } from "react";
import { filterSlashCommands, slashMenuSections } from "@/lib/slashMenu";

export type BlockInsertMenuProps = {
  t: TFunction;
  filter: string;
  onFilterChange?: (v: string) => void;
  showFilterInput: boolean;
  selectedIndex: number;
  onSelectedIndexChange: (i: number) => void;
  onPick: (def: SlashCommandDef) => void;
  searchPlaceholder: string;
  /** When no commands match */
  emptyHint?: string;
};

export function BlockInsertMenu(props: BlockInsertMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterSlashCommands(props.filter, props.t), [props.filter, props.t]);
  const sections = useMemo(() => slashMenuSections(filtered), [filtered]);
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (props.showFilterInput) inputRef.current?.focus();
  }, [props.showFilterInput]);

  const safeIndex = flat.length ? Math.min(props.selectedIndex, flat.length - 1) : 0;

  const moveSel = (delta: number) => {
    if (!flat.length) return;
    const next = (safeIndex + delta + flat.length) % flat.length;
    props.onSelectedIndexChange(next);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSel(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSel(-1);
    } else if (e.key === "Enter" && flat[safeIndex]) {
      e.preventDefault();
      props.onPick(flat[safeIndex]!);
    }
  };

  return (
    <div
      className="flex flex-col overflow-hidden border"
      style={{
        borderRadius: "var(--pa-radius-md)",
        background: "var(--pa-surface)",
        borderColor: "var(--pa-divider)",
        boxShadow: "var(--pa-popover-shadow)",
        minWidth: "280px",
        maxHeight: "min(360px, 70vh)",
      }}
    >
      {props.showFilterInput ? (
        <input
          ref={inputRef}
          type="search"
          className="w-full px-3 py-2 text-sm border-b outline-none bg-transparent"
          style={{ borderColor: "var(--pa-divider)" }}
          placeholder={props.searchPlaceholder}
          value={props.filter}
          onChange={(e) => {
            props.onFilterChange?.(e.target.value);
            props.onSelectedIndexChange(0);
          }}
          onKeyDown={onInputKeyDown}
        />
      ) : null}
      <div className="overflow-y-auto flex-1 py-1 text-sm">
        {flat.length === 0 ? (
          <p className="px-3 py-3 text-[var(--pa-tertiary)] text-center text-xs">
            {props.emptyHint ?? "—"}
          </p>
        ) : (
          sections.map((sec) => (
            <div key={sec.section}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--pa-tertiary)]">
                {props.t(sec.titleKey)}
              </div>
              {sec.items.map((def) => {
                const idx = flat.indexOf(def);
                const active = idx === safeIndex;
                return (
                  <button
                    key={def.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 ${
                      active ? "bg-[var(--pa-hover)]" : "hover:bg-[var(--pa-hover)]"
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => props.onPick(def)}
                    onMouseEnter={() => props.onSelectedIndexChange(idx)}
                  >
                    {def.icon ? (
                      <span className="w-7 shrink-0 text-center text-xs text-[var(--pa-tertiary)] tabular-nums">
                        {def.icon}
                      </span>
                    ) : (
                      <span className="w-7 shrink-0" />
                    )}
                    <span className="truncate">{props.t(def.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

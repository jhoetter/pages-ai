import { type SlashCommandDef, type SlashSection, slashCommandRegistry } from "@pagesai/core";
import type { TFunction } from "i18next";

export function filterSlashCommands(query: string, t: TFunction): SlashCommandDef[] {
  const q = query.trim().toLowerCase();
  return slashCommandRegistry.filter((def) => {
    if (!q) return true;
    if (def.id.toLowerCase().startsWith(q)) return true;
    const label = String(t(def.labelKey)).toLowerCase();
    if (label.includes(q)) return true;
    return def.keywords.some((k) => {
      const kl = k.toLowerCase();
      return kl.startsWith(q) || kl.includes(q);
    });
  });
}

export function slashMenuSections(
  filtered: SlashCommandDef[],
): { section: SlashSection; titleKey: string; items: SlashCommandDef[] }[] {
  const basic = filtered.filter((d) => (d.section ?? "basic") === "basic");
  const link = filtered.filter((d) => d.section === "link");
  const out: { section: SlashSection; titleKey: string; items: SlashCommandDef[] }[] = [];
  if (basic.length > 0) {
    out.push({ section: "basic", titleKey: "editor.slash.sectionBasic", items: basic });
  }
  if (link.length > 0) {
    out.push({ section: "link", titleKey: "editor.slash.sectionLink", items: link });
  }
  return out;
}

export function slashMenuFlat(filtered: SlashCommandDef[]): SlashCommandDef[] {
  return slashMenuSections(filtered).flatMap((s) => s.items);
}

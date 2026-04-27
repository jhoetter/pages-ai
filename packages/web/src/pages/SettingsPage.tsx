import { useTranslation } from "react-i18next";

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl mb-4">{t("nav.settings")}</h1>
      <p className="text-sm text-[var(--pa-secondary)] leading-relaxed">{t("settings.shortcutsHint")}</p>
    </div>
  );
}

import { useTranslation } from "react-i18next";

export function TemplatesPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <h1 className="text-xl">{t("nav.templates")}</h1>
    </div>
  );
}

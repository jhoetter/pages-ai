/**
 * Thin wrapper around `emoji-mart` for the page icon picker (same UX as
 * collaboration-ai composer / reactions).
 *
 * `emoji-mart` ships its own picker + data bundle. We use the `Picker`
 * component directly with the Slack-style "search → grid" UX and honour
 * light/dark via `@hofos/shell-ui` theme classes on `<html>`.
 *
 * Category tab icons use `lucide-react` so the picker matches the rest
 * of the chrome.
 */
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Apple, Car, Clock, Dog, Flag, Heart, Lightbulb, Smile, Volleyball } from "lucide-react";
import { type ComponentType, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
  /** When set, shows a footer action to clear the current icon (page editor). */
  onRemove?: () => void;
  removeLabel?: string;
}

function readHofResolvedScheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const root = document.documentElement;
  if (root.classList.contains("hof-theme-dark")) return "dark";
  if (root.classList.contains("hof-theme-light")) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useHofResolvedScheme(): "light" | "dark" {
  const [scheme, setScheme] = useState<"light" | "dark">(() => readHofResolvedScheme());

  useEffect(() => {
    setScheme(readHofResolvedScheme());
    const root = document.documentElement;
    const obs = new MutationObserver(() => {
      setScheme(readHofResolvedScheme());
    });
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => {
      setScheme(readHofResolvedScheme());
    };
    mq.addEventListener("change", onMq);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, []);

  return scheme;
}

type LucideComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
  style?: CSSProperties;
}>;

const OUTLINE_STYLE: CSSProperties = {
  fill: "none",
  stroke: "currentColor",
};

function toSvg(Icon: LucideComponent): { svg: string } {
  return {
    svg: renderToStaticMarkup(<Icon size={18} strokeWidth={1.75} style={OUTLINE_STYLE} aria-hidden />),
  };
}

const CATEGORY_ICONS = {
  frequent: toSvg(Clock),
  people: toSvg(Smile),
  nature: toSvg(Dog),
  foods: toSvg(Apple),
  activity: toSvg(Volleyball),
  places: toSvg(Car),
  objects: toSvg(Lightbulb),
  symbols: toSvg(Heart),
  flags: toSvg(Flag),
};

export function EmojiPicker({ onPick, onClose, onRemove, removeLabel }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const resolvedScheme = useHofResolvedScheme();

  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [onClose]);

  const categoryIcons = useMemo(() => ({ ...CATEGORY_ICONS }), []);

  const showRemove = Boolean(onRemove && removeLabel?.trim());

  return (
    <div ref={ref} className="w-[min(20rem,calc(100vw-1rem))]">
      <Picker
        data={data}
        theme={resolvedScheme}
        previewPosition="none"
        skinTonePosition="none"
        categoryIcons={categoryIcons}
        onEmojiSelect={(emoji: { native?: string; shortcodes?: string }) => {
          onPick(emoji.native ?? emoji.shortcodes ?? "");
        }}
      />
      {showRemove ? (
        <div className="border-t" style={{ borderColor: "var(--pa-divider)" }}>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs text-[var(--pa-secondary)] hover:bg-[var(--pa-hover)]"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              onRemove?.();
              onClose();
            }}
          >
            {removeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

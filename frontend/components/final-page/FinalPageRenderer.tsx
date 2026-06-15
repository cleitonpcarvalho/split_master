"use client";

import {
  ArrowRight,
  Check,
  ExternalLink,
  Quote,
  ShieldCheck,
} from "lucide-react";

import type { FinalPageBlock } from "@/lib/api";

interface FinalPageRendererProps {
  blocks: FinalPageBlock[];
  variables: Record<string, string>;
  primaryColor: string;
  backgroundColor: string;
  logoUrl?: string | null;
  quizTitle?: string;
  compact?: boolean;
  onCtaClick?: (url: string, block: FinalPageBlock) => void;
  onCheckoutClick?: (checkoutId: string | undefined, block: FinalPageBlock) => void;
}

export function FinalPageRenderer({
  blocks,
  variables,
  primaryColor,
  backgroundColor,
  logoUrl,
  quizTitle = "Quiz",
  compact = false,
  onCtaClick,
  onCheckoutClick,
}: FinalPageRendererProps) {
  return (
    <div
      className={`mx-auto min-h-full w-full ${compact ? "max-w-xl" : "max-w-3xl"}`}
      style={{ backgroundColor }}
    >
      {logoUrl && (
        <div
          className="mx-auto mb-8 h-14 w-44 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: safeBackgroundImage(logoUrl) }}
          role="img"
          aria-label={quizTitle}
        />
      )}

      <div className={compact ? "space-y-5" : "space-y-7"}>
        {blocks.map((block) => (
          <FinalPageBlockView
            key={block.id}
            block={block}
            variables={variables}
            primaryColor={primaryColor}
            compact={compact}
            onCtaClick={onCtaClick}
            onCheckoutClick={onCheckoutClick}
          />
        ))}
      </div>
    </div>
  );
}

function FinalPageBlockView({
  block,
  variables,
  primaryColor,
  compact,
  onCtaClick,
  onCheckoutClick,
}: {
  block: FinalPageBlock;
  variables: Record<string, string>;
  primaryColor: string;
  compact: boolean;
  onCtaClick?: FinalPageRendererProps["onCtaClick"];
  onCheckoutClick?: FinalPageRendererProps["onCheckoutClick"];
}) {
  const align = getAlign(block.settings.align);
  const text = interpolateVariables(getString(block.content.text), variables);

  if (block.type === "title") {
    return (
      <h1
        className={`${compact ? "text-2xl" : "text-3xl sm:text-5xl"} whitespace-pre-line font-black leading-tight`}
        style={{
          color: getString(block.settings.color) || "#0F1F3D",
          textAlign: align,
        }}
      >
        {text}
      </h1>
    );
  }

  if (block.type === "subtitle") {
    return (
      <h2
        className={`${compact ? "text-lg" : "text-xl sm:text-2xl"} whitespace-pre-line font-extrabold leading-snug`}
        style={{
          color: getString(block.settings.color) || "#0F1F3D",
          textAlign: align,
        }}
      >
        {text}
      </h2>
    );
  }

  if (block.type === "paragraph") {
    return (
      <p
        className={`${compact ? "text-sm leading-6" : "text-base leading-8"} whitespace-pre-line`}
        style={{
          color: getString(block.settings.color) || "#334155",
          textAlign: align,
        }}
      >
        {text}
      </p>
    );
  }

  if (block.type === "image") {
    const url = safeHttpUrl(getString(block.content.url));

    if (!url) {
      return (
        <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white/50 text-sm font-bold text-navy/35">
          Imagem ainda não configurada
        </div>
      );
    }

    return (
      <div
        className="mx-auto w-full bg-contain bg-center bg-no-repeat"
        style={{
          aspectRatio: getString(block.settings.ratio) || "16 / 9",
          backgroundImage: safeBackgroundImage(url),
          borderRadius: `${getNumber(block.settings.radius, 16)}px`,
          maxWidth: getString(block.settings.width) === "medium" ? "560px" : undefined,
        }}
        role="img"
        aria-label={getString(block.content.alt) || "Imagem da página final"}
      />
    );
  }

  if (block.type === "video") {
    const embedUrl = getVideoEmbedUrl(getString(block.content.url));

    if (!embedUrl) {
      return (
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-navy/[0.03] text-sm font-bold text-navy/35">
          Cole uma URL válida do YouTube ou Vimeo
        </div>
      );
    }

    return (
      <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-lg">
        <iframe
          src={embedUrl}
          title="Vídeo da página final"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (block.type === "bullets") {
    const items = getStringArray(block.content.items);

    return (
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex items-start gap-3 text-sm font-semibold leading-6 sm:text-base"
            style={{ color: getString(block.settings.color) || "#0F1F3D" }}
          >
            <span
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${primaryColor}25`, color: primaryColor }}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            {interpolateVariables(item, variables)}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "testimonial") {
    const photoUrl = safeHttpUrl(getString(block.content.photoUrl));

    return (
      <figure
        className="rounded-3xl p-6 sm:p-8"
        style={{
          backgroundColor:
            getString(block.settings.backgroundColor) || "#F8FAFC",
        }}
      >
        <Quote className="h-8 w-8 text-navy/15" />
        <blockquote className="mt-3 whitespace-pre-line text-base font-semibold leading-7 text-navy/75">
          {interpolateVariables(getString(block.content.text), variables)}
        </blockquote>
        <figcaption className="mt-5 flex items-center gap-3">
          {photoUrl ? (
            <div
              className="h-11 w-11 rounded-full bg-cover bg-center"
              style={{ backgroundImage: safeBackgroundImage(photoUrl) }}
              role="img"
              aria-label={getString(block.content.name)}
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/10 text-sm font-black text-navy/45">
              {getString(block.content.name).slice(0, 1).toUpperCase() || "C"}
            </div>
          )}
          <div>
            <p className="text-sm font-extrabold text-navy">
              {getString(block.content.name)}
            </p>
            <p className="text-xs text-navy/45">
              {getString(block.content.role)}
            </p>
          </div>
        </figcaption>
      </figure>
    );
  }

  if (block.type === "cta_button") {
    const url = resolveActionUrl(getString(block.content.url), variables);

    return (
      <div style={{ textAlign: align }}>
        <button
          type="button"
          disabled={!url}
          onClick={() => url && onCtaClick?.(url, block)}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-8 text-base font-extrabold shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          style={{
            backgroundColor: getString(block.settings.color) || primaryColor,
            color: getString(block.settings.textColor) || "#0F1F3D",
          }}
        >
          {text || "Saiba mais"}
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (block.type === "checkout_button") {
    const checkoutId = getString(block.content.checkoutId) || undefined;

    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => onCheckoutClick?.(checkoutId, block)}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-8 text-base font-extrabold shadow-lg transition hover:-translate-y-0.5 sm:w-auto"
          style={{
            backgroundColor: getString(block.settings.color) || primaryColor,
            color: getString(block.settings.textColor) || "#0F1F3D",
          }}
        >
          {text || "Ir para o checkout"}
          <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mx-auto mt-3 flex max-w-md items-center justify-center gap-1.5 text-[11px] font-semibold text-navy/40">
          <ShieldCheck className="h-3.5 w-3.5" />
          Seus dados serão preenchidos quando disponíveis. Revise-os no checkout.
        </p>
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <hr
        className="border-0"
        style={{
          height: `${getNumber(block.settings.thickness, 1)}px`,
          backgroundColor: getString(block.settings.color) || "#E2E8F0",
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{ height: `${getNumber(block.settings.height, 32)}px` }}
    />
  );
}

export function interpolateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => variables[name] || "",
  );
}

export function resolveActionUrl(
  template: string,
  variables: Record<string, string>,
): string | null {
  const resolved = template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => encodeURIComponent(variables[name] || ""),
  );

  return safeHttpUrl(resolved);
}

function getVideoEmbedUrl(value: string): string | null {
  const url = safeHttpUrl(value);

  if (!url) {
    return null;
  }

  const parsed = new URL(url);

  if (parsed.hostname === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (
    parsed.hostname === "youtube.com" ||
    parsed.hostname === "www.youtube.com"
  ) {
    const id =
      parsed.searchParams.get("v") ||
      parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (parsed.hostname === "vimeo.com" || parsed.hostname === "www.vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean).at(-1);
    return id && /^\d+$/.test(id)
      ? `https://player.vimeo.com/video/${id}`
      : null;
  }

  return null;
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function safeBackgroundImage(value: string): string {
  const url = safeHttpUrl(value);
  return url ? `url("${url.replaceAll('"', "%22")}")` : "none";
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getAlign(value: unknown): "left" | "center" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

import { codeToHtml } from "shiki";

interface HighlightedCodeProps {
  code: string;
  lang?: string;
  theme?: string;
  /**
   * Optional custom label for screen readers.
   * Defaults to describing the language.
   */
  ariaLabel?: string;
}

export async function HighlightedCode({
  code,
  lang = "typescript",
  // Linear uses a dark, subtle high-contrast theme (vesper or dark-plus style token mapping)
  theme = "vesper",
  ariaLabel
}: HighlightedCodeProps) {
  const trimmedCode = code.trim();

  // Generate HTML using dual themes or Shiki's fine-tuned token rendering
  const html = await codeToHtml(trimmedCode, {
    lang,
    theme
  });

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={ariaLabel || `${lang.toUpperCase()} code example`}
      className="group relative not-prose rounded-lg dark:bg-[#0d0e11] border border-white/[0.08] p-4 sm:p-5 font-mono text-[13px] leading-relaxed text-[#f7f8f8] selection:bg-[#5e6ad2]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e6ad2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0e11] overflow-x-auto"
    >
      <div
        className="
          [&_pre]:!bg-transparent
          [&_pre]:!m-0
          [&_pre]:!p-0
          [&_pre]:!leading-[1.65]
          [&_code]:!font-mono
          [&_code]:!text-[13px]
          [&_code]:!tracking-normal
          [&_.line]:inline-block
          [&_.line]:w-full
        "
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

import { useEffect, useRef, useMemo } from "react";
import { generateEpubDocument } from "@/lib/epub-renderer-utils";

interface HtmlRendererProps {
  html: string;
  css?: string;
  font?: string;
  boldText?: boolean;
  lineSpacing?: number;
  characterSpacing?: number;
  wordSpacing?: number;
  selectedTheme?: string;
  isDarkMode?: boolean;
}

export function HtmlRenderer({
  html,
  css = "",
  font = "georgia",
  boldText = false,
  lineSpacing = 1.65,
  characterSpacing = 0,
  wordSpacing = 0,
  selectedTheme = "original",
  isDarkMode = false,
}: HtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const htmlContent = useMemo(
    () =>
      generateEpubDocument({
        html,
        css,
        font,
        boldText,
        lineSpacing,
        characterSpacing,
        wordSpacing,
        paginated: false,
      }),
    [html, css, font, boldText, lineSpacing, characterSpacing, wordSpacing, selectedTheme, isDarkMode]
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();
  }, [htmlContent]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0"
      sandbox="allow-same-origin"
      title="EPUB Content"
      data-testid="iframe-epub-content"
    />
  );
}

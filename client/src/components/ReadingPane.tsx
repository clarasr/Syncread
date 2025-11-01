import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { FONT_FAMILIES } from "@/lib/epub-renderer-utils";

export interface ReadingPaneProps {
  content: string;
  highlightedSentenceIndex?: number;
  chapterTitle?: string;
  font?: string;
  boldText?: boolean;
  lineSpacing?: number;
  characterSpacing?: number;
  wordSpacing?: number;
  syncedUpToWord?: number;
  isProgressiveMode?: boolean;
}

interface ParsedSentence {
  text: string;
  globalIndex: number;
}

interface ParsedParagraph {
  sentences: ParsedSentence[];
}

function normalizeContent(content: string): ParsedParagraph[] {
  const normalized = content.replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  let globalIndex = 0;

  return paragraphs.map((block) => {
    const sentenceMatches = block.split(/(?<=[.!?])\s+/).filter(Boolean);
    const sentences: ParsedSentence[] = (sentenceMatches.length > 0
      ? sentenceMatches
      : [block]
    ).map((sentence) => ({
      text: sentence.trim(),
      globalIndex: globalIndex++,
    }));

    return { sentences };
  });
}

export function ReadingPane({
  content,
  highlightedSentenceIndex = -1,
  chapterTitle,
  font = "georgia",
  boldText = false,
  lineSpacing = 1.65,
  characterSpacing = 0,
  wordSpacing = 0,
  syncedUpToWord,
  isProgressiveMode = false,
}: ReadingPaneProps) {
  const paragraphs = useMemo(() => normalizeContent(content), [content]);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const totalWords = useMemo(() => {
    const trimmed = content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [content]);

  const progressPercent = useMemo(() => {
    if (!isProgressiveMode || typeof syncedUpToWord !== "number" || totalWords === 0) {
      return 0;
    }
    return Math.min(100, Math.round((syncedUpToWord / totalWords) * 100));
  }, [isProgressiveMode, syncedUpToWord, totalWords]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedSentenceIndex, paragraphs]);

  const textStyle = {
    fontFamily: FONT_FAMILIES[font] ?? FONT_FAMILIES.georgia,
    fontWeight: boldText ? 600 : 400,
    lineHeight: lineSpacing,
    letterSpacing: `${characterSpacing}em`,
    wordSpacing: `${wordSpacing}em`,
  } as const;

  return (
    <div className="h-full overflow-y-auto px-6 py-8" data-testid="reading-pane" style={textStyle}>
      {chapterTitle && (
        <h2 className="text-2xl font-semibold tracking-tight mb-6" data-testid="text-chapter-title">
          {chapterTitle}
        </h2>
      )}

      {isProgressiveMode && typeof syncedUpToWord === "number" && totalWords > 0 && (
        <div className="mb-6 space-y-2" data-testid="progressive-progress">
          <div className="text-xs text-muted-foreground">
            {syncedUpToWord} of {totalWords} words ready
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {paragraphs.length === 0 ? (
        <p className="text-muted-foreground" data-testid="text-empty-reader">
          No text available for this section yet.
        </p>
      ) : (
        paragraphs.map((paragraph, paragraphIndex) => (
          <p key={paragraphIndex} className="mb-6 leading-relaxed text-lg">
            {paragraph.sentences.map((sentence) => {
              const isHighlighted = sentence.globalIndex === highlightedSentenceIndex;
              return (
                <span
                  key={`${paragraphIndex}-${sentence.globalIndex}`}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={clsx(
                    "transition-colors",
                    isHighlighted && "bg-primary/20 px-1 rounded-sm shadow-sm"
                  )}
                  data-highlighted={isHighlighted || undefined}
                >
                  {sentence.text}
                  {" "}
                </span>
              );
            })}
          </p>
        ))
      )}
    </div>
  );
}

export default ReadingPane;

import { useEffect, useRef } from "react";

interface ReadingPaneProps {
  content: string;
  highlightedSentenceIndex?: number;
  chapterTitle?: string;
  font?: string;
  boldText?: boolean;
  lineSpacing?: number;
  characterSpacing?: number;
  wordSpacing?: number;
  syncedUpToWord?: number; // For progressive sync - only show content up to this word
  isProgressiveMode?: boolean;
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
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightedSentenceIndex]);

  // For progressive mode, truncate content to synced words
  let displayContent = content;
  if (isProgressiveMode && syncedUpToWord !== undefined) {
    const words = content.split(/\s+/);
    const syncedWords = words.slice(0, syncedUpToWord);
    displayContent = syncedWords.join(' ');
  }

  const sentences = displayContent.split(/(?<=[.!?])\s+/);

  const fontFamilies: Record<string, string> = {
    georgia: "var(--font-reading-georgia)",
    palatino: "var(--font-reading-palatino)",
    charter: "var(--font-reading-charter)",
    "new-york": "var(--font-reading-new-york)",
    "san-francisco": "var(--font-reading-sf)",
    iowan: "var(--font-reading-iowan)",
  };

  return (
    <div 
      className="h-full overflow-y-auto scroll-smooth"
      style={{
        backgroundColor: `hsl(var(--reading-background))`,
        color: `hsl(var(--reading-foreground))`,
      }}
    >
      <div className="max-w-[65ch] mx-auto px-6 md:px-8 py-12 md:py-16">
        {chapterTitle && (
          <h2 
            className="text-3xl md:text-4xl font-semibold mb-12 tracking-tight" 
            data-testid="text-chapter-title"
            style={{
              fontFamily: fontFamilies[font] || fontFamilies.georgia,
            }}
          >
            {chapterTitle}
          </h2>
        )}
        
        <div 
          className="text-lg md:text-xl"
          style={{
            fontFamily: fontFamilies[font] || fontFamilies.georgia,
            fontWeight: boldText ? 600 : 400,
            lineHeight: lineSpacing,
            letterSpacing: `${characterSpacing}em`,
            wordSpacing: `${wordSpacing}em`,
          }}
        >
          {sentences.map((sentence, index) => {
            const isHighlighted = index === highlightedSentenceIndex;
            return (
              <span
                key={index}
                ref={isHighlighted ? highlightRef : null}
                className={`transition-all duration-300 ${
                  isHighlighted
                    ? "font-semibold underline decoration-2 underline-offset-4"
                    : ""
                }`}
                data-testid={isHighlighted ? "text-highlighted-sentence" : undefined}
              >
                {sentence}{" "}
              </span>
            );
          })}
          
          {/* Loading indicator for progressive sync */}
          {isProgressiveMode && syncedUpToWord !== undefined && syncedUpToWord < content.split(/\s+/).length && (
            <div className="mt-8 pt-8 border-t border-reading-secondary/20 flex items-center justify-center gap-2 opacity-60" data-testid="loading-more-indicator">
              <div className="h-2 w-2 rounded-full bg-reading-foreground animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-reading-foreground animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="h-2 w-2 rounded-full bg-reading-foreground animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

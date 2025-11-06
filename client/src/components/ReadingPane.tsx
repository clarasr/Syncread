import { useMemo } from "react";

interface ReadingPaneProps {
  content: string;
  highlightedSentenceIndex: number;
  chapterTitle?: string;
  font: string;
  boldText: boolean;
  lineSpacing: number;
  characterSpacing: number;
  wordSpacing: number;
  syncedUpToWord?: number;
  isProgressiveMode?: boolean;
}

export function ReadingPane({
  content,
  highlightedSentenceIndex,
  chapterTitle,
  font,
  boldText,
  lineSpacing,
  characterSpacing,
  wordSpacing,
  syncedUpToWord,
  isProgressiveMode,
}: ReadingPaneProps) {
  // Split content into sentences
  const sentences = useMemo(() => {
    return content
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
  }, [content]);

  // Calculate word positions for progressive mode
  const wordPositions = useMemo(() => {
    if (!isProgressiveMode || syncedUpToWord === undefined) return null;
    
    let wordCount = 0;
    const positions: number[] = [];
    
    sentences.forEach((sentence) => {
      positions.push(wordCount);
      wordCount += sentence.split(/\s+/).length;
    });
    
    return positions;
  }, [sentences, isProgressiveMode, syncedUpToWord]);

  const getFontFamily = (font: string) => {
    const fonts: Record<string, string> = {
      georgia: "Georgia, serif",
      palatino: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
      times: "'Times New Roman', Times, serif",
      "new-york": "'New York', 'Times New Roman', serif",
      iowan: "'Iowan Old Style', 'Palatino Linotype', serif",
      seravek: "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, sans-serif",
      athelas: "Athelas, Georgia, serif",
      charter: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif",
      "sf-pro": "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
    };
    return fonts[font] || fonts.georgia;
  };

  return (
    <div 
      className="h-full overflow-y-auto px-6 py-8"
      data-testid="reading-pane"
    >
      <div className="max-w-3xl mx-auto">
        {chapterTitle && (
          <h2 
            className="text-2xl font-bold mb-6"
            data-testid="chapter-title"
          >
            {chapterTitle}
          </h2>
        )}
        
        <div
          style={{
            fontFamily: getFontFamily(font),
            fontWeight: boldText ? 600 : 400,
            lineHeight: lineSpacing,
            letterSpacing: `${characterSpacing}em`,
            wordSpacing: `${wordSpacing}em`,
          }}
          className="text-lg"
        >
          {sentences.map((sentence, index) => {
            const isHighlighted = index === highlightedSentenceIndex;
            const isSynced = wordPositions 
              ? wordPositions[index] < (syncedUpToWord || 0)
              : true;
            const isUnsynced = isProgressiveMode && !isSynced;

            return (
              <span
                key={index}
                style={{
                  backgroundColor: isHighlighted ? '#ffeb3b' : 'transparent',
                  opacity: isUnsynced ? 0.3 : 1,
                  transition: 'all 0.2s'
                }}
                data-testid={`sentence-${index}`}
              >
                {sentence}{" "}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

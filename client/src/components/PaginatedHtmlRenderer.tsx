import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { generateEpubDocument } from "@/lib/epub-renderer-utils";

interface PaginatedHtmlRendererProps {
  html: string;
  css?: string;
  font?: string;
  boldText?: boolean;
  lineSpacing?: number;
  characterSpacing?: number;
  wordSpacing?: number;
  selectedTheme?: string;
  isDarkMode?: boolean;
  onPageChange?: (currentPage: number, totalPages: number) => void;
}

export function PaginatedHtmlRenderer({
  html,
  css = "",
  font = "georgia",
  boldText = false,
  lineSpacing = 1.65,
  characterSpacing = 0,
  wordSpacing = 0,
  selectedTheme = "original",
  isDarkMode = false,
  onPageChange,
}: PaginatedHtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const currentPageRef = useRef(currentPage);

  // Keep ref in sync with state
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

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
        paginated: true,
      }),
    [html, css, font, boldText, lineSpacing, characterSpacing, wordSpacing, selectedTheme, isDarkMode]
  );

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentPage < totalPages) {
      goToNextPage();
    }
    if (isRightSwipe && currentPage > 1) {
      goToPreviousPage();
    }
  };

  // Unified setter that updates both ref and state atomically
  const setPageWithRef = useCallback((page: number | ((prev: number) => number)) => {
    const newPage = typeof page === 'function' ? page(currentPage) : page;
    currentPageRef.current = newPage;
    setCurrentPage(newPage);
  }, [currentPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setPageWithRef((prev) => prev + 1);
    }
  }, [currentPage, totalPages, setPageWithRef]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setPageWithRef((prev) => prev - 1);
    }
  }, [currentPage, setPageWithRef]);

  const handleLeftTapZone = () => {
    if (currentPage > 1) {
      goToPreviousPage();
    }
  };

  const handleRightTapZone = () => {
    if (currentPage < totalPages) {
      goToNextPage();
    }
  };

  // Calculate pagination when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Save current scroll position BEFORE rewriting iframe content
    const savedScrollTop = iframeDoc.documentElement?.scrollTop || iframeDoc.body?.scrollTop || 0;
    const savedViewportHeight = containerRef.current?.clientHeight || 0;
    const savedCurrentPage = savedScrollTop > 0 && savedViewportHeight > 0 
      ? Math.max(1, Math.ceil(savedScrollTop / savedViewportHeight))
      : currentPage;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Calculate total pages after content loads
    const calculatePages = () => {
      const body = iframeDoc.body;
      if (!body || !containerRef.current) return;

      const viewportHeight = containerRef.current.clientHeight;
      const contentHeight = body.scrollHeight;
      const pages = Math.max(1, Math.ceil(contentHeight / viewportHeight));
      
      setTotalPages(pages);
      
      // Use the latest current page from ref (for window resize) or saved page (for effect re-run)
      const pageToRestore = currentPageRef.current || savedCurrentPage;
      const restoredPage = Math.min(pageToRestore, pages);
      
      // Update both ref and state atomically
      currentPageRef.current = restoredPage;
      setCurrentPage(restoredPage);
    };

    // Wait for iframe to fully load including images
    iframe.onload = () => {
      setTimeout(calculatePages, 100);
    };

    // Recalculate on window resize
    const handleResize = () => {
      setTimeout(calculatePages, 100);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [htmlContent]);

  // Scroll to current page
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !containerRef.current) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const viewportHeight = containerRef.current.clientHeight;
    const scrollPosition = (currentPage - 1) * viewportHeight;
    
    iframeDoc.documentElement.scrollTop = scrollPosition;
    iframeDoc.body.scrollTop = scrollPosition;

    if (onPageChange) {
      onPageChange(currentPage, totalPages);
    }
  }, [currentPage, totalPages, onPageChange]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Tap zones for desktop */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div 
          className="w-1/3 h-full cursor-pointer pointer-events-auto"
          onClick={handleLeftTapZone}
          data-testid="tap-zone-prev"
        />
        <div className="w-1/3 h-full" />
        <div 
          className="w-1/3 h-full cursor-pointer pointer-events-auto"
          onClick={handleRightTapZone}
          data-testid="tap-zone-next"
        />
      </div>

      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-same-origin"
        title="EPUB Content"
        data-testid="iframe-epub-content"
      />

      {/* Navigation Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
          data-testid="button-prev-page"
          className="h-8 w-8"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <span className="text-sm text-muted-foreground min-w-[80px] text-center" data-testid="text-page-indicator">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
          data-testid="button-next-page"
          className="h-8 w-8"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

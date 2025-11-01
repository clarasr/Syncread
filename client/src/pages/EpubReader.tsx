import { ReadingPane } from "@/components/ReadingPane";
import { HtmlRenderer } from "@/components/HtmlRenderer";
import { PaginatedHtmlRenderer } from "@/components/PaginatedHtmlRenderer";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TypographyCustomizer } from "@/components/TypographyCustomizer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Type, Palette, RefreshCw, BookOpen, Scroll } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { useReaderTheme } from "@/hooks/use-reader-theme";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EpubBook } from "@shared/schema";

export default function EpubReader() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const epubId = searchParams.get("id");
  const { toast } = useToast();

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState("original");
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Typography state
  const [typographySettings, setTypographySettings] = useState({
    font: "georgia",
    boldText: false,
    lineSpacing: 1.65,
    characterSpacing: 0,
    wordSpacing: 0,
  });

  // Pagination mode state
  const [isPaginatedMode, setIsPaginatedMode] = useState(() => {
    const saved = localStorage.getItem("epub-pagination-mode");
    return saved === "true";
  });

  // Modal state
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTypographyModal, setShowTypographyModal] = useState(false);

  // Persist pagination preference
  useEffect(() => {
    localStorage.setItem("epub-pagination-mode", String(isPaginatedMode));
  }, [isPaginatedMode]);

  // Apply reader theme
  useReaderTheme(selectedTheme, isDarkMode);

  // Fetch EPUB data
  const { data: epub, isLoading } = useQuery<EpubBook>({
    queryKey: [`/api/library/epubs/${epubId}`],
    enabled: !!epubId,
  });

  // Reprocess EPUB mutation
  const reprocessMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/library/epubs/${epubId}/reprocess`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/library/epubs/${epubId}`] });
      toast({
        title: "Success",
        description: "EPUB formatting has been updated and will load automatically.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reprocess EPUB",
        variant: "destructive",
      });
    },
  });

  if (!epubId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No EPUB selected</h2>
          <Button onClick={() => setLocation("/")} data-testid="button-back-library">
            Return to Library
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading book...</div>
      </div>
    );
  }

  if (!epub) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Book not found</h2>
          <Button onClick={() => setLocation("/")} data-testid="button-back-library">
            Return to Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" data-theme={selectedTheme}>
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-sm" data-testid="text-book-title">
                {epub.title || epub.filename}
              </h1>
              {epub.author && (
                <p className="text-xs text-muted-foreground">{epub.author}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Show reprocess button if htmlChapters not available */}
            {(!epub.htmlChapters || epub.htmlChapters.length === 0) && (
              <Button
                variant="default"
                size="sm"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending}
                data-testid="button-reprocess"
              >
                {reprocessMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Processing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Enable Formatting</span>
                  </>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPaginatedMode(!isPaginatedMode)}
              data-testid="button-toggle-pagination"
              title={isPaginatedMode ? "Switch to Scroll Mode" : "Switch to Page Mode"}
            >
              {isPaginatedMode ? <Scroll className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowThemeModal(true)}
              data-testid="button-theme"
            >
              <Palette className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTypographyModal(true)}
              data-testid="button-typography"
            >
              <Type className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Reading Pane - Use HTML renderer if available, otherwise plain text */}
      {epub.htmlChapters && epub.htmlChapters.length > 0 ? (
        <div className="flex-1 overflow-hidden">
          {isPaginatedMode ? (
            <PaginatedHtmlRenderer
              html={epub.htmlChapters.map(ch => ch.html).join('\n')}
              css={epub.htmlChapters.map(ch => ch.css || '').join('\n')}
              font={typographySettings.font}
              boldText={typographySettings.boldText}
              lineSpacing={typographySettings.lineSpacing}
              characterSpacing={typographySettings.characterSpacing}
              wordSpacing={typographySettings.wordSpacing}
              selectedTheme={selectedTheme}
              isDarkMode={isDarkMode}
            />
          ) : (
            <HtmlRenderer
              html={epub.htmlChapters.map(ch => ch.html).join('\n')}
              css={epub.htmlChapters.map(ch => ch.css || '').join('\n')}
              font={typographySettings.font}
              boldText={typographySettings.boldText}
              lineSpacing={typographySettings.lineSpacing}
              characterSpacing={typographySettings.characterSpacing}
              wordSpacing={typographySettings.wordSpacing}
              selectedTheme={selectedTheme}
              isDarkMode={isDarkMode}
            />
          )}
        </div>
      ) : (
        <ReadingPane
          content={epub.textContent}
          highlightedSentenceIndex={-1}
          font={typographySettings.font}
          boldText={typographySettings.boldText}
          lineSpacing={typographySettings.lineSpacing}
          characterSpacing={typographySettings.characterSpacing}
          wordSpacing={typographySettings.wordSpacing}
        />
      )}

      {/* Theme Modal */}
      <Dialog open={showThemeModal} onOpenChange={setShowThemeModal}>
        <DialogContent data-testid="dialog-theme">
          <DialogHeader>
            <DialogTitle>Theme</DialogTitle>
          </DialogHeader>
          <ThemeSelector
            selectedTheme={selectedTheme}
            isDarkMode={isDarkMode}
            onThemeChange={setSelectedTheme}
            onDarkModeToggle={() => setIsDarkMode(!isDarkMode)}
          />
        </DialogContent>
      </Dialog>

      {/* Typography Modal */}
      <Dialog open={showTypographyModal} onOpenChange={setShowTypographyModal}>
        <DialogContent data-testid="dialog-typography">
          <DialogHeader>
            <DialogTitle>Typography</DialogTitle>
          </DialogHeader>
          <TypographyCustomizer
            settings={typographySettings}
            onSettingsChange={setTypographySettings}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

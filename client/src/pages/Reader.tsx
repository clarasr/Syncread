import { ReadingPane } from "@/components/ReadingPane";
import { HtmlRenderer } from "@/components/HtmlRenderer";
import { PaginatedHtmlRenderer } from "@/components/PaginatedHtmlRenderer";
import { IntegratedAudioPlayer } from "@/components/IntegratedAudioPlayer";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TypographyCustomizer } from "@/components/TypographyCustomizer";
import { ProcessingModal } from "@/components/ProcessingModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, ArrowLeft, Type, Palette, AlertCircle, Scroll } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useReaderTheme } from "@/hooks/use-reader-theme";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SyncSession, EpubBook, Audiobook } from "@shared/schema";
import { useDebouncedProgress } from "@/hooks/useDebouncedProgress";

export default function Reader() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session");

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [highlightedParagraph, setHighlightedParagraph] = useState(0);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

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

  // Modal state
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showTypographyModal, setShowTypographyModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);

  // Pagination mode state
  const [isPaginatedMode, setIsPaginatedMode] = useState(() => {
    const saved = localStorage.getItem("reader-pagination-mode");
    return saved === "true";
  });

  // Reset modalDismissed immediately when sessionId changes
  useEffect(() => {
    setModalDismissed(false);
  }, [sessionId]);

  // Persist pagination preference
  useEffect(() => {
    localStorage.setItem("reader-pagination-mode", String(isPaginatedMode));
  }, [isPaginatedMode]);

  // Apply reader theme
  useReaderTheme(selectedTheme, isDarkMode);

  // Fetch sync session
  const { data: session, isLoading: sessionLoading } = useQuery<SyncSession>({
    queryKey: ["/api/sync", sessionId],
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data as SyncSession | undefined;
      // Keep polling for processing, pending, and paused states
      if (data?.status === "processing" || data?.status === "pending" || data?.status === "paused") {
        return 2000;
      }
      return false;
    },
  });

  // Reset modalDismissed when syncedUpToWord returns to 0 (server-side reset)
  useEffect(() => {
    if (session && (session.syncedUpToWord || 0) === 0) {
      setModalDismissed(false);
    }
  }, [session?.syncedUpToWord]);

  // Fetch EPUB data
  const { data: epub } = useQuery<EpubBook>({
    queryKey: ["/api/epub", session?.epubId],
    enabled: !!session?.epubId,
  });

  // Fetch audiobook data  
  const { data: audiobook } = useQuery<Audiobook>({
    queryKey: ["/api/audiobook", session?.audioId],
    enabled: !!session?.audioId,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handleTimeUpdateRef = useRef<(() => void) | null>(null);
  const handleEndedRef = useRef<(() => void) | null>(null);
  const resumeAppliedRef = useRef(false);
  const latestSessionRef = useRef<SyncSession | null>(null);

  const resolveDuration = () => {
    const rawDuration = audioRef.current?.duration;
    if (typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0) {
      return rawDuration;
    }
    if (typeof audiobook?.duration === "number" && audiobook.duration > 0) {
      return audiobook.duration;
    }
    return undefined;
  };

  const { schedule: scheduleProgressUpdate, flush: flushProgressUpdate } = useDebouncedProgress(
    async (positionSec) => {
      if (!sessionId) return;
      const duration = resolveDuration();
      const clampedPosition = duration ? Math.min(Math.max(positionSec, 0), duration) : Math.max(positionSec, 0);

      try {
        const updatedSession = await apiRequest(`/api/sync/${sessionId}/progress`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            positionSec: clampedPosition,
            durationSec: duration ?? null,
            progressVersion: latestSessionRef.current?.progressVersion ?? 1,
          }),
        });

        if (updatedSession) {
          latestSessionRef.current = updatedSession;
          queryClient.setQueryData(["/api/sync", sessionId], updatedSession);
        }
      } catch (error) {
        console.error("Failed to persist playback progress:", error);
      }
    },
    5000
  );

  const applyStoredPlaybackPosition = () => {
    const latest = latestSessionRef.current;
    if (!latest || !audioRef.current || resumeAppliedRef.current) return;

    const stored = latest.playbackPositionSec ?? 0;
    if (stored <= 0) {
      resumeAppliedRef.current = true;
      return;
    }

    const duration = resolveDuration();
    const clamped = duration ? Math.min(stored, duration) : stored;
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    resumeAppliedRef.current = true;
  };

  useEffect(() => {
    latestSessionRef.current = session ?? null;
    if (!session) {
      resumeAppliedRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    if ((session?.playbackPositionSec ?? 0) === 0) {
      resumeAppliedRef.current = false;
    }
  }, [session?.playbackPositionSec]);

  useEffect(() => {
    applyStoredPlaybackPosition();
  }, [session?.playbackPositionSec, audiobook?.id]);


  useEffect(() => {
    if (!sessionId || !isPlaying) return;
    scheduleProgressUpdate(currentTime);
  }, [currentTime, isPlaying, sessionId, scheduleProgressUpdate]);

  useEffect(() => {
    if (isPlaying || !sessionId) return;
    scheduleProgressUpdate(currentTime);
    flushProgressUpdate();
  }, [isPlaying, sessionId, currentTime, scheduleProgressUpdate, flushProgressUpdate]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushProgressUpdate();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [flushProgressUpdate]);

  // Auto-advance progressive sync when approaching end of synced content
  const advanceRequestedRef = useRef(false);
  const lastSyncedWordRef = useRef(0);
  
  useEffect(() => {
    if (!session || !epub || session.syncMode !== "progressive") return;
    
    // Don't auto-advance if sync is complete or paused
    if (session.status === "complete" || session.status === "paused") return;
    
    const syncedWords = session.syncedUpToWord || 0;
    const totalWords = epub.textContent.split(/\s+/).length;
    
    // Reset advance flag when synced words increase
    if (syncedWords > lastSyncedWordRef.current) {
      lastSyncedWordRef.current = syncedWords;
      advanceRequestedRef.current = false;
    }
    
    // If we're within 500 words of the synced limit and haven't requested yet
    if (syncedWords > 0 && syncedWords < totalWords) {
      // Calculate current word position from text index
      const wordsBeforeIndex = epub.textContent.slice(0, currentTextIndex).split(/\s+/).length;
      const threshold = syncedWords - 500;
      
      if (wordsBeforeIndex >= threshold && !advanceRequestedRef.current) {
        advanceRequestedRef.current = true;
        apiRequest(`/api/sync/${sessionId}/advance`, { method: "POST" })
          .then(() => {
            console.log("Next chunk requested at word", wordsBeforeIndex);
          })
          .catch(err => {
            console.error("Failed to advance sync:", err);
            advanceRequestedRef.current = false;
          });
      }
    }
  }, [currentTextIndex, session, epub, sessionId]);

  // Initialize audio element
  useEffect(() => {
    if (!audiobook?.id || audioRef.current) return;

    const audio = new Audio(`/api/library/audiobooks/${audiobook.id}/stream`);

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleLoadedMetadata = () => {
      applyStoredPlaybackPosition();
    };

    // Store refs for cleanup
    handleTimeUpdateRef.current = handleTimeUpdate;
    handleEndedRef.current = handleEnded;

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    // Set initial playback properties from current state
    audio.playbackRate = playbackSpeed;
    audio.volume = volume;

    audioRef.current = audio;
    applyStoredPlaybackPosition();

    // If user already hit play before audio loaded, start playback
    if (isPlaying) {
      audio.play().catch(err => {
        console.error("Failed to play audio on init:", err);
        setIsPlaying(false);
      });
    }

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [audiobook?.id]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error("Failed to play audio:", err);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Calculate highlighted paragraph based on current audio time and sync anchors
  useEffect(() => {
    if (!session?.syncAnchors || !epub?.textContent || session.syncAnchors.length === 0) {
      setHighlightedParagraph(0);
      return;
    }

    // Find the text index corresponding to current audio time
    const anchors = session.syncAnchors;
    let textIndex = 0;

    // Find the last anchor before or at current time
    for (let i = anchors.length - 1; i >= 0; i--) {
      if (anchors[i].audioTime <= currentTime) {
        textIndex = anchors[i].textIndex;
        break;
      }
    }

    // Update current text index for progressive sync advance
    setCurrentTextIndex(textIndex);

    // Split content into paragraphs to find which paragraph contains this text index
    const paragraphs = epub.textContent
      .split(/\n\n+|\n/)
      .filter((p) => p.trim().length > 0);

    let charCount = 0;
    let paragraphIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      charCount += paragraphs[i].length + 1; // +1 for newline
      if (charCount > textIndex) {
        paragraphIndex = i;
        break;
      }
    }

    setHighlightedParagraph(paragraphIndex);
  }, [currentTime, session?.syncAnchors, epub?.textContent]);

  const handleSkipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
      scheduleProgressUpdate(audioRef.current.currentTime);
    }
  };

  const handleSkipForward = () => {
    if (audioRef.current && audiobook) {
      const maxTime = resolveDuration() ?? audiobook.duration;
      audioRef.current.currentTime = Math.min(maxTime, audioRef.current.currentTime + 15);
      scheduleProgressUpdate(audioRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      const maxTime = resolveDuration();
      const clamped = maxTime ? Math.min(Math.max(time, 0), maxTime) : Math.max(time, 0);
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      scheduleProgressUpdate(clamped);
      flushProgressUpdate();
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No session found</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const isProcessing = session.status === "processing" || session.status === "pending";
  const hasError = session.status === "error";
  const isComplete = session.status === "complete";
  const isPaused = session.status === "paused";

  // For progressive mode, allow reading if any content is synced (including when paused)
  const canRead = isComplete || isPaused || (session.syncMode === "progressive" && (session.syncedUpToWord || 0) > 0);

  // Determine if processing modal should show
  const shouldShowModal = isProcessing && !modalDismissed && (
    session.syncMode !== "progressive" || (session.syncedUpToWord || 0) === 0
  );

  const resolvedDuration = resolveDuration() ?? (typeof audiobook?.duration === "number" ? audiobook.duration : 0);

  return (
    <div className="h-screen flex flex-col" data-theme={selectedTheme}>
      {/* Processing modal - dismissible in progressive mode once content is synced */}
      <ProcessingModal
        isOpen={shouldShowModal}
        currentStep={session.currentStep || "extracting"}
        progress={session.progress || 0}
        totalChunks={session.totalChunks ?? undefined}
        currentChunk={session.currentChunk ?? undefined}
        onOpenChange={(open) => {
          if (!open && session.syncMode === "progressive" && (session.syncedUpToWord || 0) > 0) {
            setModalDismissed(true);
          }
        }}
      />

      {/* Error state - show full screen error with retry option */}
      {hasError ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="rounded-full bg-destructive/10 w-16 h-16 flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Sync Failed</h3>
              <p className="text-sm text-muted-foreground mb-1">
                {session.error || "Failed to process sync"}
              </p>
              <p className="text-xs text-muted-foreground">
                This may be due to incompatible audio format or processing errors.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => setLocation("/library")}
                data-testid="button-back-to-library"
              >
                Back to Library
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await apiRequest(`/api/sync/${sessionId}/retry`, { method: "POST" });
                    queryClient.invalidateQueries({ queryKey: ["/api/sync", sessionId] });
                  } catch (error: any) {
                    console.error("Retry failed:", error);
                  }
                }}
                data-testid="button-retry-sync"
              >
                Retry Sync
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Progressive sync status banner */}
      {session.syncMode === "progressive" && epub && (session.syncedUpToWord || 0) > 0 && (session.status === "processing" || session.status === "paused") && (
        <div className={session.status === "paused" ? "bg-muted border-b border-border p-2" : "bg-primary/10 border-b border-primary/20 p-2"}>
          <div className="container mx-auto flex items-center justify-center gap-3">
            {session.status === "processing" && (
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
            <p className={session.status === "paused" ? "text-muted-foreground text-xs" : "text-primary text-xs"} data-testid="text-sync-status">
              {session.status === "paused" ? "Paused: " : "Syncing... "}
              {session.syncedUpToWord || 0} of {epub.textContent.split(/\s+/).length} words ready
            </p>
            {session.status === "processing" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                data-testid="button-pause-sync"
                onClick={async () => {
                  try {
                    await apiRequest(`/api/sync/${sessionId}/pause`, { method: "POST" });
                    // Invalidate query to refetch updated session
                    queryClient.invalidateQueries({ queryKey: ["/api/sync", sessionId] });
                  } catch (error) {
                    console.error("Failed to pause sync:", error);
                  }
                }}
              >
                Pause
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                data-testid="button-resume-sync"
                onClick={async () => {
                  try {
                    await apiRequest(`/api/sync/${sessionId}/resume`, { method: "POST" });
                    // Invalidate query to refetch updated session and restart polling
                    queryClient.invalidateQueries({ queryKey: ["/api/sync", sessionId] });
                  } catch (error) {
                    console.error("Failed to resume sync:", error);
                  }
                }}
              >
                Resume
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Header - Compact and functional */}
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
                {epub?.title || "Loading..."}
              </h1>
              {epub?.author && (
                <p className="text-xs text-muted-foreground">{epub.author}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {epub?.htmlChapters && epub.htmlChapters.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsPaginatedMode(!isPaginatedMode)}
                data-testid="button-toggle-pagination"
                title={isPaginatedMode ? "Switch to Scroll Mode" : "Switch to Page Mode"}
              >
                {isPaginatedMode ? <Scroll className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              </Button>
            )}
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

      {/* Reading Pane - Use text-only view for highlighting during sync */}
      <div className="flex-1 overflow-hidden">
        {epub && canRead ? (
          <ReadingPane
            content={epub.textContent}
            highlightedParagraphIndex={highlightedParagraph}
            chapterTitle={epub.chapters?.[0]?.title}
            font={typographySettings.font}
            boldText={typographySettings.boldText}
            lineSpacing={typographySettings.lineSpacing}
            characterSpacing={typographySettings.characterSpacing}
            wordSpacing={typographySettings.wordSpacing}
            syncedUpToWord={session.syncedUpToWord ?? undefined}
            isProgressiveMode={session.syncMode === "progressive"}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">
              {isProcessing ? "Preparing your first chunk..." : "Waiting for sync to start"}
            </p>
          </div>
        )}
      </div>

      {/* Audio Player - Show when reading is available */}
      {audiobook && canRead && (
        <IntegratedAudioPlayer
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={resolvedDuration}
          playbackSpeed={playbackSpeed}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onSeek={handleSeek}
          onSkipBack={handleSkipBack}
          onSkipForward={handleSkipForward}
          onSpeedChange={setPlaybackSpeed}
        />
      )}
        </>
      )}

      {/* Theme Customization Modal */}
      <Dialog open={showThemeModal} onOpenChange={setShowThemeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Theme</DialogTitle>
          </DialogHeader>
          <ThemeSelector
            selectedTheme={selectedTheme}
            isDarkMode={isDarkMode}
            onThemeChange={setSelectedTheme}
            onDarkModeToggle={setIsDarkMode}
          />
        </DialogContent>
      </Dialog>

      {/* Typography Customization Modal */}
      <Dialog open={showTypographyModal} onOpenChange={setShowTypographyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Text</DialogTitle>
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

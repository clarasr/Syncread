/**
 * MinimizedAudioPlayer - Collapsible audio player for mode switching
 *
 * RESERVED FOR V1.0 - Enhanced Reading Modes
 *
 * Purpose:
 * - Show minimized audio player at bottom of screen while reading EPUB-only
 * - Allow listening to audiobook while browsing library
 * - Enable seamless mode switching without losing playback position
 *
 * Features:
 * - Minimized bar with progress indicator
 * - Expands to full player on click
 * - Shows book cover, title, chapter info
 * - Volume and playback speed controls
 *
 * Difference from IntegratedAudioPlayer:
 * - This is for standalone audio playback (not synced with text)
 * - IntegratedAudioPlayer is for synced reading mode (karaoke highlighting)
 */

import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface MinimizedAudioPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bookTitle: string;
  chapterTitle: string;
  coverImage?: string;
  playbackSpeed: number;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
}

export function MinimizedAudioPlayer({
  isPlaying,
  currentTime,
  duration,
  bookTitle,
  chapterTitle,
  coverImage,
  playbackSpeed,
  volume,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onSpeedChange,
  onVolumeChange,
}: MinimizedAudioPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : Math.max(currentTime || 0, 1);
  const progress = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  if (!isExpanded) {
    // Minimized Bar
    return (
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {/* Progress Bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Minimized Controls */}
        <div
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center gap-3 p-3 hover-elevate active-elevate-2 cursor-pointer"
          data-testid="button-expand-player"
        >
          {/* Book Cover Thumbnail */}
          {coverImage ? (
            <img
              src={coverImage}
              alt={bookTitle}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No Cover</span>
            </div>
          )}

          {/* Book Info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{bookTitle}</div>
            <div className="text-xs text-muted-foreground truncate">{chapterTitle}</div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onSkipBack();
              }}
              data-testid="button-skip-back-mini"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause();
              }}
              data-testid="button-play-pause-mini"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onSkipForward();
              }}
              data-testid="button-skip-forward-mini"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Time Display */}
          <div className="text-xs text-muted-foreground tabular-nums hidden sm:block">
            {formatTime(currentTime)} / {formatTime(safeDuration)}
          </div>

          {/* Expand Button */}
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-expand"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Expanded Player
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Collapse Button */}
      <div className="flex justify-end p-2 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(false)}
          data-testid="button-collapse-player"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6 space-y-4">
        {/* Book Info */}
        <div className="flex items-center gap-4">
          {coverImage ? (
            <img
              src={coverImage}
              alt={bookTitle}
              className="h-16 w-16 rounded object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No Cover</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{bookTitle}</div>
            <div className="text-sm text-muted-foreground truncate">{chapterTitle}</div>
          </div>
        </div>

        {/* Progress Slider */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={safeDuration}
            step={0.1}
            onValueChange={([value]) => onSeek(value)}
            className="w-full"
            data-testid="audio-progress-slider-expanded"
          />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(safeDuration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSkipBack}
            data-testid="button-skip-back-expanded"
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            size="icon"
            className="h-12 w-12"
            onClick={onPlayPause}
            data-testid="button-play-pause-expanded"
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onSkipForward}
            data-testid="button-skip-forward-expanded"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Additional Controls */}
        <div className="flex items-center gap-6">
          {/* Volume */}
          <div className="flex items-center gap-2 flex-1">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={([value]) => onVolumeChange(value / 100)}
              className="flex-1"
              data-testid="volume-slider"
            />
          </div>

          {/* Playback Speed */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Speed:</span>
            <div className="flex gap-1">
              {speeds.map((speed) => (
                <Button
                  key={speed}
                  variant={playbackSpeed === speed ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onSpeedChange(speed)}
                  className={cn(
                    "h-7 w-12 text-xs",
                    playbackSpeed === speed && "font-semibold"
                  )}
                  data-testid={`speed-${speed}x-expanded`}
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

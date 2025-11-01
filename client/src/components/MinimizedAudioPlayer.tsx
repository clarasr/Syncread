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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
        <button
          onClick={() => setIsExpanded(true)}
          className="flex w-full items-center gap-3 p-3 hover-elevate active-elevate-2"
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

          {/* Info */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{chapterTitle}</p>
            <p className="text-xs text-muted-foreground truncate">{bookTitle}</p>
          </div>

          {/* Play Button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onPlayPause();
            }}
            data-testid="button-play-pause-mini"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          {/* Expand Icon */}
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  // Expanded Player
  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsExpanded(false)}
          data-testid="button-minimize-player"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
        <p className="text-sm font-medium">Now Playing</p>
        <div className="w-10" /> {/* Spacer for center alignment */}
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center p-8 space-y-6">
        {/* Large Book Cover */}
        {coverImage ? (
          <img 
            src={coverImage} 
            alt={bookTitle}
            className="w-64 h-64 rounded-lg shadow-lg object-cover"
          />
        ) : (
          <div className="w-64 h-64 rounded-lg bg-muted flex items-center justify-center shadow-lg">
            <p className="text-muted-foreground">No Cover</p>
          </div>
        )}

        {/* Track Info */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold">{chapterTitle}</h2>
          <p className="text-sm text-muted-foreground">{bookTitle}</p>
        </div>

        {/* Seek Slider */}
        <div className="w-full max-w-md space-y-2">
          <Slider
            value={[currentTime]}
            onValueChange={([value]) => onSeek(value)}
            min={0}
            max={duration}
            step={1}
            data-testid="slider-seek"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-6">
          <Button
            size="icon"
            variant="ghost"
            onClick={onSkipBack}
            data-testid="button-skip-back"
          >
            <SkipBack className="h-6 w-6" />
          </Button>

          <Button
            size="icon"
            className="h-16 w-16"
            onClick={onPlayPause}
            data-testid="button-play-pause-full"
          >
            {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={onSkipForward}
            data-testid="button-skip-forward"
          >
            <SkipForward className="h-6 w-6" />
          </Button>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Speed:</p>
          <div className="flex gap-1">
            {speeds.map(speed => (
              <Button
                key={speed}
                size="sm"
                variant={playbackSpeed === speed ? "default" : "ghost"}
                onClick={() => onSpeedChange(speed)}
                data-testid={`button-speed-${speed}`}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>

        {/* Volume Control */}
        <div className="w-full max-w-md flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            onValueChange={([value]) => onVolumeChange(value / 100)}
            min={0}
            max={100}
            step={1}
            data-testid="slider-volume"
          />
        </div>
      </div>
    </div>
  );
}

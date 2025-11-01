import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Timer,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Audiobook } from "@shared/schema";

export default function AudiobookPlayer() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const audioId = searchParams.get("id");

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  // Sleep timer state
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null);
  const [sleepTimerDialogOpen, setSleepTimerDialogOpen] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch audiobook data
  const { data: audiobook, isLoading } = useQuery<Audiobook>({
    queryKey: [`/api/library/audiobooks/${audioId}`],
    enabled: !!audioId,
  });

  // Initialize audio element
  useEffect(() => {
    if (audiobook && !audioRef.current) {
      const audio = new Audio(`/api/library/audiobooks/${audiobook.id}/stream`);
      audio.addEventListener("timeupdate", () => {
        setCurrentTime(audio.currentTime);
      });
      audio.addEventListener("ended", () => {
        setIsPlaying(false);
      });
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audiobook]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
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
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle sleep timer countdown
  useEffect(() => {
    if (sleepTimerSeconds === null || sleepTimerSeconds <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerSeconds(prev => {
        if (prev === null || prev <= 1) {
          // Timer reached zero - pause playback
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerSeconds]);

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration, audioRef.current.currentTime + seconds));
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSleepTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const startSleepTimer = (minutes: number) => {
    setSleepTimerSeconds(minutes * 60);
    setSleepTimerDialogOpen(false);
  };

  const cancelSleepTimer = () => {
    setSleepTimerSeconds(null);
  };

  if (!audioId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No audiobook selected</h2>
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
        <div className="animate-pulse text-muted-foreground">Loading audiobook...</div>
      </div>
    );
  }

  if (!audiobook) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Audiobook not found</h2>
          <Button onClick={() => setLocation("/")} data-testid="button-back-library">
            Return to Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {sleepTimerSeconds !== null && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Timer className="h-4 w-4" />
                <span data-testid="text-sleep-timer">{formatSleepTimer(sleepTimerSeconds)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={cancelSleepTimer}
                  data-testid="button-cancel-sleep-timer"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Cover Art Placeholder */}
          <div className="aspect-square w-full max-w-sm mx-auto bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg flex items-center justify-center">
            <div className="text-center space-y-4">
              <Music className="h-24 w-24 mx-auto text-purple-500 opacity-50" />
              <h2 className="text-xl font-semibold px-4" data-testid="text-audiobook-title">
                {audiobook.filename.replace(/\.(mp3|m4a|m4b)$/i, "")}
              </h2>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={audiobook.duration}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
              data-testid="slider-progress"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span data-testid="text-current-time">{formatTime(currentTime)}</span>
              <span data-testid="text-duration">{formatTime(audiobook.duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSkip(-15)}
              data-testid="button-skip-back"
            >
              <SkipBack className="h-6 w-6" />
            </Button>
            
            <Button
              size="icon"
              className="h-16 w-16"
              onClick={() => setIsPlaying(!isPlaying)}
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8" />
              ) : (
                <Play className="h-8 w-8" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSkip(15)}
              data-testid="button-skip-forward"
            >
              <SkipForward className="h-6 w-6" />
            </Button>
          </div>

          {/* Additional Controls */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              {/* Playback Speed */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Speed:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const speeds = [0.75, 1, 1.25, 1.5, 1.75, 2];
                    const currentIndex = speeds.indexOf(playbackSpeed);
                    const nextIndex = (currentIndex + 1) % speeds.length;
                    setPlaybackSpeed(speeds[nextIndex]);
                  }}
                  data-testid="button-speed"
                >
                  {playbackSpeed}x
                </Button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  data-testid="button-mute"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={(value) => {
                    setVolume(value[0]);
                    if (value[0] > 0) setIsMuted(false);
                  }}
                  className="w-24 cursor-pointer"
                  data-testid="slider-volume"
                />
              </div>
            </div>

            {/* Sleep Timer Button */}
            <div className="flex justify-center">
              <Dialog open={sleepTimerDialogOpen} onOpenChange={setSleepTimerDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant={sleepTimerSeconds !== null ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    data-testid="button-open-sleep-timer"
                  >
                    <Timer className="h-4 w-4" />
                    {sleepTimerSeconds !== null ? `Sleep: ${formatSleepTimer(sleepTimerSeconds)}` : "Sleep Timer"}
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-sleep-timer">
                  <DialogHeader>
                    <DialogTitle>Sleep Timer</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-2 pt-4">
                    {[5, 10, 15, 30, 45, 60].map((minutes) => (
                      <Button
                        key={minutes}
                        variant="outline"
                        onClick={() => startSleepTimer(minutes)}
                        data-testid={`button-sleep-timer-${minutes}`}
                      >
                        {minutes} min
                      </Button>
                    ))}
                  </div>
                  {sleepTimerSeconds !== null && (
                    <Button
                      variant="ghost"
                      onClick={cancelSleepTimer}
                      className="mt-2"
                      data-testid="button-cancel-sleep-timer-dialog"
                    >
                      Cancel Timer
                    </Button>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

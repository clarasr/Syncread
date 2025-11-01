import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useState } from "react";

interface AudioPlayerProps {
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onSpeedChange?: (speed: number) => void;
  playbackSpeed?: number;
}

export function AudioPlayer({
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onPlayPause = () => {},
  onSeek = () => {},
  onSpeedChange = () => {},
  playbackSpeed = 1,
}: AudioPlayerProps) {
  const [volume, setVolume] = useState(80);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSkip = (seconds: number) => {
    onSeek(Math.max(0, Math.min(duration, currentTime + seconds)));
  };

  return (
    <Card className="fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-md md:relative md:bg-card md:backdrop-blur-none">
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={([value]) => onSeek(value)}
            className="cursor-pointer"
            data-testid="slider-audio-progress"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-current-time">{formatTime(currentTime)}</span>
            <span data-testid="text-duration">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSkip(-15)}
              data-testid="button-skip-back"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              variant="default"
              size="icon"
              className="h-12 w-12"
              onClick={onPlayPause}
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSkip(15)}
              data-testid="button-skip-forward"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              max={100}
              step={1}
              onValueChange={([value]) => setVolume(value)}
              className="w-24"
              data-testid="slider-volume"
            />
          </div>

          <Select
            value={playbackSpeed.toString()}
            onValueChange={(value) => onSpeedChange(parseFloat(value))}
          >
            <SelectTrigger className="w-20" data-testid="select-playback-speed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">0.5×</SelectItem>
              <SelectItem value="0.75">0.75×</SelectItem>
              <SelectItem value="1">1×</SelectItem>
              <SelectItem value="1.25">1.25×</SelectItem>
              <SelectItem value="1.5">1.5×</SelectItem>
              <SelectItem value="2">2×</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

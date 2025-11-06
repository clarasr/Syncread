import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface IntegratedAudioPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSpeedChange: (speed: number) => void;
}

export function IntegratedAudioPlayer({
  isPlaying,
  currentTime,
  duration,
  playbackSpeed,
  onPlayPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onSpeedChange,
}: IntegratedAudioPlayerProps) {
  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const safeDuration =
    Number.isFinite(duration) && duration > 0
      ? duration
      : Math.max(currentTime || 0, 1);

  const handleSliderChange = (values: number[]) => {
    onSeek(values[0]);
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  return (
    <div className="border-t bg-card">
      {/* Progress Bar */}
      <div className="px-6 pt-4">
        <Slider
          value={[currentTime]}
          max={safeDuration}
          step={0.1}
          onValueChange={handleSliderChange}
          className="w-full"
          data-testid="audio-progress-slider"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span data-testid="audio-current-time">{formatTime(currentTime)}</span>
          <span data-testid="audio-duration">{formatTime(safeDuration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 px-6 py-4">
        {/* Skip Back 15s */}
        <Button
          size="icon"
          variant="ghost"
          onClick={onSkipBack}
          data-testid="button-skip-back"
        >
          <SkipBack className="h-5 w-5" />
        </Button>

        {/* Play/Pause */}
        <Button
          size="icon"
          className="h-12 w-12"
          onClick={onPlayPause}
          data-testid="button-play-pause"
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </Button>

        {/* Skip Forward 15s */}
        <Button
          size="icon"
          variant="ghost"
          onClick={onSkipForward}
          data-testid="button-skip-forward"
        >
          <SkipForward className="h-5 w-5" />
        </Button>

        {/* Playback Speed */}
        <div className="ml-4">
          <Select
            value={playbackSpeed.toString()}
            onValueChange={(value) => onSpeedChange(parseFloat(value))}
          >
            <SelectTrigger className="w-20" data-testid="speed-selector">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {speeds.map((speed) => (
                <SelectItem
                  key={speed}
                  value={speed.toString()}
                  data-testid={`speed-${speed}x`}
                >
                  {speed}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

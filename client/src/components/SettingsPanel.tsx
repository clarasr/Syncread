/**
 * SettingsPanel - Global app settings
 *
 * RESERVED FOR V0.4 - Cost Management
 *
 * Purpose:
 * - Allow users to select Whisper transcription model before sync
 * - Balance cost vs accuracy based on user preference
 * - Configure reading experience settings
 *
 * Planned Features:
 * - Whisper model selection:
 *   - Fast (whisper-tiny): Cheaper, less accurate, faster
 *   - Balanced (whisper-base): Default option
 *   - Accurate (whisper-large): Expensive, best accuracy
 * - Show estimated cost before starting sync
 * - Auto-scroll toggle for synced reading
 * - Global text size preference
 *
 * TODO (V0.4):
 * - Add cost calculation based on audio duration and model
 * - Add "preview sync" button (first 30 seconds)
 * - Persist user preferences in database
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";

interface SettingsPanelProps {
  whisperModel?: "fast" | "balanced" | "accurate";
  onWhisperModelChange?: (model: "fast" | "balanced" | "accurate") => void;
  autoScroll?: boolean;
  onAutoScrollChange?: (enabled: boolean) => void;
  textSize?: number;
  onTextSizeChange?: (size: number) => void;
}

export function SettingsPanel({
  whisperModel = "balanced",
  onWhisperModelChange = () => {},
  autoScroll = true,
  onAutoScrollChange = () => {},
  textSize = 16,
  onTextSizeChange = () => {},
}: SettingsPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-settings">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Customize your reading and sync preferences
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 pt-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">Whisper Model</Label>
            <RadioGroup
              value={whisperModel}
              onValueChange={(value) =>
                onWhisperModelChange(value as "fast" | "balanced" | "accurate")
              }
              className="space-y-3"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="fast" id="fast" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="fast" className="font-medium">
                    Fast (Lower Cost)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Faster processing, lower accuracy. Best for clear recordings.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="balanced" id="balanced" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="balanced" className="font-medium">
                    Balanced (Recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Good balance of speed, accuracy, and cost.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="accurate" id="accurate" />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="accurate" className="font-medium">
                    Accurate (Higher Cost)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Best accuracy for difficult audio or accents.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="auto-scroll" className="text-base font-medium">
                Auto Scroll
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically scroll to keep highlighted text in view
              </p>
            </div>
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={onAutoScrollChange}
              data-testid="switch-auto-scroll"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="text-size" className="text-base font-medium">
              Text Size: {textSize}px
            </Label>
            <Slider
              id="text-size"
              value={[textSize]}
              min={12}
              max={24}
              step={1}
              onValueChange={([value]) => onTextSizeChange(value)}
              data-testid="slider-text-size"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

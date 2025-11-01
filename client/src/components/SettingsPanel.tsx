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
              data-testid="radio-whisper-model"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fast" id="fast" />
                <Label htmlFor="fast" className="font-normal cursor-pointer">
                  Fast - Quick processing
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="balanced" id="balanced" />
                <Label htmlFor="balanced" className="font-normal cursor-pointer">
                  Balanced - Good accuracy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="accurate" id="accurate" />
                <Label htmlFor="accurate" className="font-normal cursor-pointer">
                  Accurate - Best quality
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-scroll" className="text-base font-medium">
              Auto-scroll
            </Label>
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={onAutoScrollChange}
              data-testid="switch-auto-scroll"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="text-size" className="text-base font-medium">
              Text Size
            </Label>
            <Slider
              id="text-size"
              value={[textSize]}
              onValueChange={([value]) => onTextSizeChange(value)}
              min={12}
              max={24}
              step={1}
              data-testid="slider-text-size"
            />
            <p className="text-sm text-muted-foreground">{textSize}px</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

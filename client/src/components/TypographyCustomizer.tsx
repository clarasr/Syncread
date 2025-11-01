import { useState } from "react";
import { Type, AlignJustify, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fonts = [
  { value: "georgia", label: "Georgia", family: "var(--font-reading-georgia)" },
  { value: "palatino", label: "Palatino", family: "var(--font-reading-palatino)" },
  { value: "charter", label: "Charter", family: "var(--font-reading-charter)" },
  { value: "new-york", label: "New York", family: "var(--font-reading-new-york)" },
  { value: "san-francisco", label: "San Francisco", family: "var(--font-reading-sf)" },
  { value: "iowan", label: "Iowan Old Style", family: "var(--font-reading-iowan)" },
];

interface TypographySettings {
  font: string;
  boldText: boolean;
  lineSpacing: number;
  characterSpacing: number;
  wordSpacing: number;
}

interface TypographyCustomizerProps {
  settings: TypographySettings;
  onSettingsChange: (settings: TypographySettings) => void;
}

export function TypographyCustomizer({ settings, onSettingsChange }: TypographyCustomizerProps) {
  const updateSetting = (key: keyof TypographySettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const selectedFont = fonts.find(f => f.value === settings.font) || fonts[0];

  return (
    <div className="space-y-6">
      {/* Preview Text */}
      <div className="rounded-lg bg-muted/30 p-6">
        <p 
          className="text-base leading-relaxed"
          style={{
            fontFamily: selectedFont.family,
            fontWeight: settings.boldText ? 600 : 400,
            lineHeight: settings.lineSpacing,
            letterSpacing: `${settings.characterSpacing}em`,
            wordSpacing: `${settings.wordSpacing}em`,
          }}
        >
          His face relaxed as if her concern had made him uncomfortable and her retort was more familiar territory. "You live a much more tenuous life than I, Xiala of the Teek. I can handle Pech."
        </p>
      </div>

      {/* Text Settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Text</h3>
        
        {/* Font Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="font-select" className="text-base">Font</Label>
          </div>
          <Select value={settings.font} onValueChange={(value) => updateSetting("font", value)}>
            <SelectTrigger id="font-select" className="w-40" data-testid="select-font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => (
                <SelectItem key={font.value} value={font.value} data-testid={`option-font-${font.value}`}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bold Text Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="bold-text" className="text-base">Bold Text</Label>
          <Switch
            id="bold-text"
            checked={settings.boldText}
            onCheckedChange={(checked) => updateSetting("boldText", checked)}
            data-testid="switch-bold-text"
          />
        </div>
      </div>

      {/* Accessibility & Layout Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Accessibility & Layout Options
        </h3>

        {/* Line Spacing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlignJustify className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground uppercase tracking-wide">Line Spacing</Label>
            </div>
            <span className="text-sm font-medium">{settings.lineSpacing.toFixed(2)}</span>
          </div>
          <Slider
            value={[settings.lineSpacing]}
            onValueChange={([value]) => updateSetting("lineSpacing", value)}
            min={1.0}
            max={2.0}
            step={0.05}
            data-testid="slider-line-spacing"
          />
        </div>

        {/* Character Spacing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground uppercase tracking-wide">Character Spacing</Label>
            </div>
            <span className="text-sm font-medium">{Math.round(settings.characterSpacing * 100)}%</span>
          </div>
          <Slider
            value={[settings.characterSpacing * 100]}
            onValueChange={([value]) => updateSetting("characterSpacing", value / 100)}
            min={-5}
            max={10}
            step={0.5}
            data-testid="slider-character-spacing"
          />
        </div>

        {/* Word Spacing */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm text-muted-foreground uppercase tracking-wide">Word Spacing</Label>
            </div>
            <span className="text-sm font-medium">{Math.round(settings.wordSpacing * 100)}%</span>
          </div>
          <Slider
            value={[settings.wordSpacing * 100]}
            onValueChange={([value]) => updateSetting("wordSpacing", value / 100)}
            min={0}
            max={20}
            step={1}
            data-testid="slider-word-spacing"
          />
        </div>
      </div>
    </div>
  );
}

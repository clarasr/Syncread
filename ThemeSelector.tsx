import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Theme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  secondary: string;
}

const themes: Theme[] = [
  { id: "original", name: "Original", background: "hsl(0 0% 100%)", foreground: "hsl(0 0% 0%)", secondary: "hsl(0 0% 40%)" },
  { id: "quiet", name: "Quiet", background: "hsl(0 0% 25%)", foreground: "hsl(0 0% 85%)", secondary: "hsl(0 0% 60%)" },
  { id: "paper", name: "Paper", background: "hsl(40 20% 96%)", foreground: "hsl(30 15% 15%)", secondary: "hsl(30 10% 40%)" },
  { id: "bold", name: "Bold", background: "hsl(0 0% 0%)", foreground: "hsl(0 0% 100%)", secondary: "hsl(0 0% 70%)" },
  { id: "calm", name: "Calm", background: "hsl(35 30% 92%)", foreground: "hsl(25 20% 20%)", secondary: "hsl(25 15% 45%)" },
  { id: "focus", name: "Focus", background: "hsl(220 15% 12%)", foreground: "hsl(220 10% 95%)", secondary: "hsl(220 10% 65%)" },
];

interface ThemeSelectorProps {
  selectedTheme?: string;
  isDarkMode?: boolean;
  onThemeChange: (themeId: string) => void;
  onDarkModeToggle: (isDark: boolean) => void;
}

export function ThemeSelector({ 
  selectedTheme = "original", 
  isDarkMode = false,
  onThemeChange, 
  onDarkModeToggle 
}: ThemeSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Light/Dark Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="dark-mode" className="text-base font-medium">
          Dark Mode
        </Label>
        <Switch
          id="dark-mode"
          checked={isDarkMode}
          onCheckedChange={onDarkModeToggle}
          data-testid="switch-dark-mode"
        />
      </div>

      {/* Theme Preview Text */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Reading Theme</p>
        <div 
          className="rounded-lg p-6 transition-colors"
          style={{ 
            backgroundColor: themes.find(t => t.id === selectedTheme)?.background,
            color: themes.find(t => t.id === selectedTheme)?.foreground
          }}
        >
          <p className="text-4xl font-serif">Aa</p>
          <p className="mt-3 text-sm" style={{ color: themes.find(t => t.id === selectedTheme)?.secondary }}>
            His face relaxed as if her concern had made him uncomfortable...
          </p>
        </div>
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            className="relative rounded-lg p-4 text-left transition-all hover-elevate active-elevate-2"
            style={{ backgroundColor: theme.background }}
            data-testid={`button-theme-${theme.id}`}
          >
            {/* Selected Checkmark */}
            {selectedTheme === theme.id && (
              <div className="absolute top-2 right-2 rounded-full bg-primary p-1">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            
            {/* Theme Preview */}
            <div className="space-y-2">
              <p className="text-2xl font-serif" style={{ color: theme.foreground }}>Aa</p>
              <p className="text-xs font-medium" style={{ color: theme.secondary }}>
                {theme.name}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { BookOpen, Headphones, Sparkles } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <span className="font-semibold text-xl">SyncRead</span>
          </div>
          <Button onClick={handleLogin} data-testid="button-login">
            Log In
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16 text-center max-w-4xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/10 rounded-full">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Read & Listen in Perfect Sync
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your EPUB and audiobook, and SyncRead uses AI to automatically
            synchronize the text with the narration for an immersive reading experience.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
              Get Started
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BookOpen className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">Upload Your Books</h3>
              <p className="text-sm text-muted-foreground">
                Supports EPUB files and MP3/M4A audiobooks up to 1GB
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">AI-Powered Sync</h3>
              <p className="text-sm text-muted-foreground">
                Whisper transcription and fuzzy matching create perfect alignment
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Headphones className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold mb-2">Immersive Reading</h3>
              <p className="text-sm text-muted-foreground">
                Apple Books-inspired design with customizable themes and typography
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 SyncRead. Built with AI-powered synchronization.</p>
        </div>
      </footer>
    </div>
  );
}

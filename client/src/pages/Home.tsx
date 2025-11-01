import { FileUploadZone } from "@/components/FileUploadZone";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Headphones, Sparkles, Palette, Type } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [epubFile, setEpubFile] = useState<File>();
  const [audioFile, setAudioFile] = useState<File>();
  const [epubId, setEpubId] = useState<string>();
  const [audioId, setAudioId] = useState<string>();
  const [uploadingEpub, setUploadingEpub] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleEpubSelect = async (file: File | null) => {
    if (!file) {
      setEpubFile(undefined);
      setEpubId(undefined);
      return;
    }

    setEpubFile(file);
    setUploadingEpub(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiRequest("/api/upload/epub", {
        method: "POST",
        body: formData,
      });

      setEpubId(response.id);
      toast({
        title: "EPUB uploaded successfully",
        description: `"${response.title}" is ready to sync`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload EPUB file",
      });
      setEpubFile(undefined);
    } finally {
      setUploadingEpub(false);
    }
  };

  const handleAudioSelect = async (file: File | null) => {
    if (!file) {
      setAudioFile(undefined);
      setAudioId(undefined);
      return;
    }

    setAudioFile(file);
    setUploadingAudio(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiRequest("/api/upload/audio", {
        method: "POST",
        body: formData,
      });

      setAudioId(response.id);
      toast({
        title: "Audiobook uploaded successfully",
        description: "Ready to sync with your EPUB",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload audiobook",
      });
      setAudioFile(undefined);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleStartSync = async () => {
    if (!epubId || !audioId) return;

    setSyncing(true);

    try {
      const response = await apiRequest("/api/sync/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epubId, audioId }),
      });

      setLocation(`/reader?session=${response.id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Failed to start sync process",
      });
      setSyncing(false);
    }
  };

  const canSync = epubId && audioId && !uploadingEpub && !uploadingAudio && !syncing;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-app-title">
              SyncRead
            </h1>
          </div>
          <Button variant="ghost" onClick={handleLogout} data-testid="button-logout">
            Log Out
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Read and Listen
              <br />
              <span className="text-muted-foreground">in Perfect Sync</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload your EPUB and audiobook. Our AI perfectly syncs them, highlighting each word as it's narrated.
            </p>
          </div>

          {/* Upload Section */}
          <div className="grid md:grid-cols-2 gap-6">
            <FileUploadZone
              type="epub"
              file={epubFile}
              onFileSelect={handleEpubSelect}
              uploadProgress={uploadingEpub ? 50 : undefined}
            />
            <FileUploadZone
              type="audio"
              file={audioFile}
              onFileSelect={handleAudioSelect}
              uploadProgress={uploadingAudio ? 50 : undefined}
            />
          </div>

          {/* Start Button */}
          <div className="flex justify-center pt-4">
            <Button
              size="lg"
              disabled={!canSync}
              onClick={handleStartSync}
              className="px-12 h-12 text-base font-medium"
              data-testid="button-start-sync"
            >
              {syncing ? "Starting..." : "Start Reading"}
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 pt-12">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">AI-Powered Sync</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Whisper AI transcribes and matches audio to text with precision
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Palette className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Beautiful Themes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Choose from multiple reading themes designed for comfort
              </p>
            </div>
            
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Type className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Custom Typography</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Adjust fonts, spacing, and text size to your preference
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by OpenAI Whisper & Fuzzy Matching
          </p>
        </div>
      </footer>
    </div>
  );
}

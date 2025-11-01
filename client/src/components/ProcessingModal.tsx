import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Music, Wand2, Link2 } from "lucide-react";

interface ProcessingModalProps {
  isOpen: boolean;
  currentStep: "extracting" | "segmenting" | "transcribing" | "matching" | "complete";
  progress: number;
  totalChunks?: number;
  currentChunk?: number;
  onOpenChange?: (open: boolean) => void;
}

const steps = {
  extracting: {
    icon: FileText,
    title: "Extracting EPUB",
    description: "Reading your book and extracting text content...",
  },
  segmenting: {
    icon: Music,
    title: "Segmenting Audio",
    description: "Creating anchor points in your audiobook...",
  },
  transcribing: {
    icon: Wand2,
    title: "Transcribing with AI",
    description: "Using Whisper to transcribe audio segments...",
  },
  matching: {
    icon: Link2,
    title: "Matching Text & Audio",
    description: "Synchronizing your reading experience...",
  },
  complete: {
    icon: Link2,
    title: "Sync Complete",
    description: "Your immersive reading experience is ready!",
  },
};

export function ProcessingModal({ 
  isOpen, 
  currentStep, 
  progress, 
  totalChunks = 1,
  currentChunk = 0,
  onOpenChange,
}: ProcessingModalProps) {
  const step = steps[currentStep];
  const Icon = step.icon;

  // Show chunk progress during transcription
  const showChunkProgress = currentStep === "transcribing" && totalChunks > 1;
  const chunkText = showChunkProgress ? `Processing chunk ${currentChunk} of ${totalChunks}` : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-primary/10 p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle data-testid="text-processing-title">{step.title}</DialogTitle>
          </div>
          <DialogDescription data-testid="text-processing-description">
            {step.description}
            {chunkText && (
              <span className="block mt-2 font-medium text-foreground" data-testid="text-chunk-progress">
                {chunkText}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Progress value={progress} className="h-2" data-testid="progress-sync" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{progress}% complete</span>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

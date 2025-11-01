import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUploadZone } from "@/components/FileUploadZone";
import { BookOpen, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
}

type UploadType = "epub" | "audio" | null;

export function UploadModal({ open, onClose }: UploadModalProps) {
  const [uploadType, setUploadType] = useState<UploadType>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setUploadType(null);
    setFile(null);
    setUploading(false);
    onClose();
  };

  const handleFileSelect = async (selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null);
      setUploading(false);
      return;
    }

    if (!uploadType) return;

    setFile(selectedFile);
    setUploading(true);

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Step 1: Get presigned upload URL from backend
      const { uploadURL } = await apiRequest("/api/objects/upload", {
        method: "POST",
      });

      // Step 2: Upload file directly to Object Storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type || "application/octet-stream",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      // Step 3: Process the uploaded file (download, extract metadata, set ACL)
      // For large files, this can take a while - show different message
      const processEndpoint = uploadType === "epub" ? "/api/process/epub" : "/api/process/audio";
      
      // Add timeout for large file processing (5 minutes)
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Processing timeout - file may still be uploading in background"));
        }, 300000);
      });
      
      const processPromise = apiRequest(processEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          uploadedURL: uploadURL,
          filename: selectedFile.name
        }),
      });

      const response = await Promise.race([processPromise, timeoutPromise]);

      // Clear timeout on success
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      toast({
        title: `${uploadType === "epub" ? "Book" : "Audiobook"} uploaded successfully`,
        description: uploadType === "epub" ? `"${response.title}" is ready` : "Ready to sync",
      });

      await queryClient.invalidateQueries({
        queryKey: [uploadType === "epub" ? "/api/library/epubs" : "/api/library/audiobooks"],
      });

      handleClose();
    } catch (error: any) {
      // Clear timeout on error as well
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const isTimeout = error.message?.includes("timeout");
      toast({
        variant: isTimeout ? "default" : "destructive",
        title: isTimeout ? "Upload in progress" : "Upload failed",
        description: isTimeout 
          ? "Large file processing continues in background. Check your library in a moment." 
          : error.message || "Failed to upload file",
      });
      
      if (isTimeout) {
        // Capture uploadType before handleClose() resets it
        const currentUploadType = uploadType;
        
        // Close modal on timeout, let background processing continue
        handleClose();
        
        // Refresh library after a delay
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: [currentUploadType === "epub" ? "/api/library/epubs" : "/api/library/audiobooks"],
          });
        }, 10000);
      } else {
        setFile(null);
        setUploading(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload to Library</DialogTitle>
        </DialogHeader>

        {!uploadType ? (
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => setUploadType("epub")}
              data-testid="button-select-epub"
            >
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="font-semibold">Upload Book</span>
              <span className="text-xs text-muted-foreground">.epub files</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => setUploadType("audio")}
              data-testid="button-select-audio"
            >
              <Music className="h-8 w-8 text-purple-500" />
              <span className="font-semibold">Upload Audiobook</span>
              <span className="text-xs text-muted-foreground">.mp3, .m4a, .m4b files</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <FileUploadZone
              type={uploadType}
              file={file || undefined}
              onFileSelect={handleFileSelect}
              uploadProgress={uploading ? 50 : undefined}
            />

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setUploadType(null);
                setFile(null);
              }}
              data-testid="button-back"
            >
              Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

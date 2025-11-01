import { Upload, FileText, Music, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

interface FileUploadZoneProps {
  type: "epub" | "audio";
  onFileSelect: (file: File | null) => void;
  file?: File;
  uploadProgress?: number;
}

export function FileUploadZone({ type, onFileSelect, file, uploadProgress }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const acceptedFormats = type === "epub" ? ".epub" : ".mp3,.m4a,.m4b";
  const icon = type === "epub" ? FileText : Music;
  const Icon = icon;

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-border"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="p-8 text-center">
        {file ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Icon className="h-8 w-8 text-primary" />
              <div className="flex-1 text-left">
                <p className="font-medium text-sm" data-testid={`text-filename-${type}`}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onFileSelect(null)}
                data-testid={`button-remove-${type}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {uploadProgress !== undefined && uploadProgress < 100 && (
              <Progress value={uploadProgress} className="h-2" />
            )}
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept={acceptedFormats}
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0] ?? null;
                onFileSelect(selectedFile);
              }}
              data-testid={`input-file-${type}`}
            />
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-medium">
                  {type === "epub" ? "Upload EPUB File" : "Upload Audiobook"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop or click to browse
                </p>
                <div className="flex justify-center gap-2">
                  {type === "epub" ? (
                    <Badge variant="secondary">.epub</Badge>
                  ) : (
                    <>
                      <Badge variant="secondary">.mp3</Badge>
                      <Badge variant="secondary">.m4a</Badge>
                      <Badge variant="secondary">.m4b</Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          </label>
        )}
      </div>
    </Card>
  );
}

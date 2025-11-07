import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookOpen, Music, Plus, PlayCircle, MoreVertical, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadModal } from "@/components/UploadModal";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { EpubBook, Audiobook, SyncSession } from "@shared/schema";

export default function Library() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedEpub, setSelectedEpub] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  
  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    type: 'epub' | 'audiobook' | null;
    id: string;
    currentName: string;
  }>({ open: false, type: null, id: '', currentName: '' });
  const [newName, setNewName] = useState('');
  
  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'epub' | 'audiobook' | null;
    id: string;
    name: string;
  }>({ open: false, type: null, id: '', name: '' });

  // Sync session delete confirmation state
  const [deleteSyncDialog, setDeleteSyncDialog] = useState<{
    open: boolean;
    id: string;
    epubTitle: string;
    audioTitle: string;
  }>({ open: false, id: '', epubTitle: '', audioTitle: '' });

  const { data: epubs = [], isLoading: loadingEpubs } = useQuery<EpubBook[]>({
    queryKey: ["/api/library/epubs"],
  });

  const { data: audiobooks = [], isLoading: loadingAudio } = useQuery<Audiobook[]>({
    queryKey: ["/api/library/audiobooks"],
  });

  const { data: syncSessions = [], isLoading: loadingSyncSessions } = useQuery<SyncSession[]>({
    queryKey: ["/api/sync-sessions"],
  });

  const renameMutation = useMutation({
    mutationFn: async ({ type, id, title }: { type: 'epub' | 'audiobook'; id: string; title: string }) => {
      const endpoint = type === 'epub' ? `/api/library/epubs/${id}` : `/api/library/audiobooks/${id}`;
      return apiRequest(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/library/epubs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/library/audiobooks'] });
      toast({
        title: "Title updated",
        description: `Successfully updated ${variables.type === 'epub' ? 'book' : 'audiobook'} title`,
      });
      setRenameDialog({ open: false, type: null, id: '', currentName: '' });
      setNewName('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update title",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'epub' | 'audiobook'; id: string }) => {
      const endpoint = type === 'epub' ? `/api/library/epubs/${id}` : `/api/library/audiobooks/${id}`;
      return apiRequest(endpoint, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/library/epubs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/library/audiobooks'] });
      toast({
        title: "File deleted",
        description: `Successfully deleted ${variables.type === 'epub' ? 'book' : 'audiobook'}`,
      });
      setDeleteDialog({ open: false, type: null, id: '', name: '' });
      if (variables.type === 'epub' && selectedEpub === variables.id) {
        setSelectedEpub(null);
      }
      if (variables.type === 'audiobook' && selectedAudio === variables.id) {
        setSelectedAudio(null);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const deleteSyncSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/sync-sessions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sync-sessions'] });
      toast({
        title: "Sync session deleted",
        description: "Successfully deleted sync session",
      });
      setDeleteSyncDialog({ open: false, id: '', epubTitle: '', audioTitle: '' });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sync session",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleSync = async () => {
    if (!selectedEpub || !selectedAudio) return;
    
    try {
      const response = await apiRequest("/api/sync/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ epubId: selectedEpub, audioId: selectedAudio }),
      });
      
      setLocation(`/reader?session=${response.id}`);
    } catch (error: any) {
      console.error("Sync failed:", error);
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: error.message || "Failed to start sync process",
      });
    }
  };

  const isLoading = loadingEpubs || loadingAudio;
  const hasFiles = epubs.length > 0 || audiobooks.length > 0;
  const canSync = selectedEpub && selectedAudio;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-library-title">
              My Library
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              onClick={() => setShowUploadModal(true)}
              data-testid="button-upload"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button variant="ghost" onClick={handleLogout} data-testid="button-logout">
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-pulse text-muted-foreground">Loading your library...</div>
          </div>
        ) : !hasFiles ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-primary/10 p-6 mb-6">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Your Library is Empty</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Upload your first EPUB and audiobook to start syncing and reading
            </p>
            <Button onClick={() => setShowUploadModal(true)} data-testid="button-upload-empty">
              <Plus className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        ) : (
          <div className="space-y-12">
            {epubs.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Books</h2>
                  <Badge variant="secondary">{epubs.length}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {epubs.map((epub) => (
                    <Card
                      key={epub.id}
                      className={`group cursor-pointer transition-all hover-elevate relative ${
                        selectedEpub === epub.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedEpub(selectedEpub === epub.id ? null : epub.id)}
                      data-testid={`card-epub-${epub.id}`}
                    >
                      <div className="aspect-[3/4] bg-gradient-to-br from-primary/10 to-primary/5 rounded-t-md flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-primary opacity-50" />
                      </div>
                      <div className="p-4 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm line-clamp-2 flex-1" data-testid={`text-epub-title-${epub.id}`}>
                            {epub.title || epub.filename.replace(/\.epub$/i, "")}
                          </h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-menu-epub-${epub.id}`}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/epub?id=${epub.id}`);
                                }}
                                data-testid={`button-read-epub-${epub.id}`}
                              >
                                <BookOpen className="h-4 w-4 mr-2" />
                                Read Only
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameDialog({
                                    open: true,
                                    type: 'epub',
                                    id: epub.id,
                                    currentName: epub.title,
                                  });
                                  setNewName(epub.title);
                                }}
                                data-testid={`button-rename-epub-${epub.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Title
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await apiRequest(`/api/epub/${epub.id}/reparse`, { method: "POST" });
                                    await queryClient.invalidateQueries({ queryKey: ["/api/library/epubs"] });
                                    toast({ title: "EPUB refreshed with paragraph breaks!" });
                                  } catch (error: any) {
                                    toast({ title: "Failed to refresh", description: error.message, variant: "destructive" });
                                  }
                                }}
                                data-testid={`button-reparse-epub-${epub.id}`}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh Paragraphs
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialog({
                                    open: true,
                                    type: 'epub',
                                    id: epub.id,
                                    name: epub.title || epub.filename,
                                  });
                                }}
                                className="text-destructive"
                                data-testid={`button-delete-epub-${epub.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {epub.author && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {epub.author}
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {audiobooks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Audiobooks</h2>
                  <Badge variant="secondary">{audiobooks.length}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {audiobooks.map((audio) => (
                    <Card
                      key={audio.id}
                      className={`group cursor-pointer transition-all hover-elevate relative ${
                        selectedAudio === audio.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedAudio(selectedAudio === audio.id ? null : audio.id)}
                      data-testid={`card-audio-${audio.id}`}
                    >
                      <div className="aspect-[3/4] bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-t-md flex items-center justify-center">
                        <Music className="h-12 w-12 text-purple-500 opacity-50" />
                      </div>
                      <div className="p-4 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm line-clamp-2 flex-1" data-testid={`text-audio-title-${audio.id}`}>
                            {audio.title || audio.filename.replace(/\.(mp3|m4a|m4b)$/i, "")}
                          </h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-menu-audio-${audio.id}`}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/audiobook?id=${audio.id}`);
                                }}
                                data-testid={`button-listen-audio-${audio.id}`}
                              >
                                <Music className="h-4 w-4 mr-2" />
                                Listen Only
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameDialog({
                                    open: true,
                                    type: 'audiobook',
                                    id: audio.id,
                                    currentName: audio.title || audio.filename.replace(/\.(mp3|m4a|m4b)$/i, ""),
                                  });
                                  setNewName(audio.title || audio.filename.replace(/\.(mp3|m4a|m4b)$/i, ""));
                                }}
                                data-testid={`button-rename-audio-${audio.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Title
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialog({
                                    open: true,
                                    type: 'audiobook',
                                    id: audio.id,
                                    name: audio.filename,
                                  });
                                }}
                                className="text-destructive"
                                data-testid={`button-delete-audio-${audio.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {Math.floor(audio.duration / 60)} min
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {syncSessions.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Sync Sessions</h2>
                  <Badge variant="secondary">{syncSessions.length}</Badge>
                </div>
                <div className="space-y-4">
                  {syncSessions.map((session) => {
                    const epub = epubs.find((e) => e.id === session.epubId);
                    const audio = audiobooks.find((a) => a.id === session.audioId);
                    const statusColors = {
                      pending: "bg-gray-500/10 text-gray-500",
                      processing: "bg-blue-500/10 text-blue-500",
                      paused: "bg-yellow-500/10 text-yellow-500",
                      complete: "bg-green-500/10 text-green-500",
                      error: "bg-red-500/10 text-red-500",
                    };
                    
                    return (
                      <Card key={session.id} className="hover-elevate" data-testid={`card-sync-${session.id}`}>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold" data-testid={`text-sync-epub-${session.id}`}>
                                  {epub?.title || "Unknown Book"}
                                </h3>
                                <span className="text-muted-foreground">+</span>
                                <h3 className="font-semibold" data-testid={`text-sync-audio-${session.id}`}>
                                  {audio?.title || audio?.filename || "Unknown Audio"}
                                </h3>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge className={statusColors[session.status]} data-testid={`badge-status-${session.id}`}>
                                  {session.status}
                                </Badge>
                                {session.syncMode && (
                                  <Badge variant="outline" data-testid={`badge-mode-${session.id}`}>
                                    {session.syncMode} mode
                                  </Badge>
                                )}
                                {session.currentStep && (
                                  <span className="text-sm text-muted-foreground" data-testid={`text-step-${session.id}`}>
                                    {session.currentStep}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {session.status === 'complete' && (
                                <Button
                                  size="sm"
                                  onClick={() => setLocation(`/reader?session=${session.id}`)}
                                  data-testid={`button-open-${session.id}`}
                                >
                                  <BookOpen className="h-4 w-4 mr-2" />
                                  Open
                                </Button>
                              )}
                              {session.status === 'processing' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled
                                  data-testid={`button-processing-${session.id}`}
                                >
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Processing
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteSyncDialog({
                                    open: true,
                                    id: session.id,
                                    epubTitle: epub?.title || "Unknown Book",
                                    audioTitle: audio?.title || audio?.filename || "Unknown Audio",
                                  });
                                }}
                                data-testid={`button-delete-sync-${session.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {canSync && (
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">Ready to sync</p>
                <p className="text-muted-foreground">
                  {epubs.find((e) => e.id === selectedEpub)?.title} + {" "}
                  {audiobooks.find((a) => a.id === selectedAudio)?.filename}
                </p>
              </div>
              <Button onClick={handleSync} size="lg" data-testid="button-sync">
                <PlayCircle className="h-5 w-5 mr-2" />
                Start Reading
              </Button>
            </div>
          </div>
        </div>
      )}

      <UploadModal open={showUploadModal} onClose={() => setShowUploadModal(false)} />
      
      {/* Rename Dialog */}
      <Dialog open={renameDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRenameDialog({ open: false, type: null, id: '', currentName: '' });
          setNewName('');
        }
      }}>
        <DialogContent data-testid="dialog-rename">
          <DialogHeader>
            <DialogTitle>Edit {renameDialog.type === 'epub' ? 'Book' : 'Audiobook'} Title</DialogTitle>
            <DialogDescription>
              Enter a new title for this {renameDialog.type === 'epub' ? 'book' : 'audiobook'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new title"
                data-testid="input-rename"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRenameDialog({ open: false, type: null, id: '', currentName: '' });
                setNewName('');
              }}
              data-testid="button-cancel-rename"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameDialog.type && newName.trim()) {
                  renameMutation.mutate({
                    type: renameDialog.type,
                    id: renameDialog.id,
                    title: newName.trim(),
                  });
                }
              }}
              disabled={!newName.trim() || renameMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameMutation.isPending ? "Updating..." : "Update Title"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteDialog({ open: false, type: null, id: '', name: '' });
        }
      }}>
        <AlertDialogContent data-testid="dialog-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type === 'epub' ? 'Book' : 'Audiobook'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialog.name}"? This action cannot be undone and will also delete any sync sessions associated with this file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.type) {
                  deleteMutation.mutate({
                    type: deleteDialog.type,
                    id: deleteDialog.id,
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sync Session Confirmation Dialog */}
      <AlertDialog open={deleteSyncDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDeleteSyncDialog({ open: false, id: '', epubTitle: '', audioTitle: '' });
        }
      }}>
        <AlertDialogContent data-testid="dialog-delete-sync">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sync Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the sync session for "{deleteSyncDialog.epubTitle}" + "{deleteSyncDialog.audioTitle}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-sync">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteSyncSessionMutation.mutate(deleteSyncDialog.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-sync"
            >
              {deleteSyncSessionMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseEpub } from "./utils/epub-parser";
import { transcribeAudioFile } from "./utils/whisper-service";
import { transcribeWithChunking } from "./utils/whisper-chunked";
import { findTextMatches } from "./utils/fuzzy-matcher";
import { calculateSyncPoints } from "./utils/sync-algorithm";
import { parseFile } from "music-metadata";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { computeFileHash } from "./utils/file-hash";
import { ObjectPermission } from "./objectAcl";
import type { SyncSession } from "@shared/schema";

// Setup multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB max file size for audiobooks
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Object Storage routes - from blueprint:javascript_object_storage
  // Endpoint for serving private objects with ACL checks
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Endpoint for getting upload URL for object entities
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    try {
      const { fileExtension } = req.body;
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(fileExtension || "");
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Process EPUB after upload to Object Storage (requires authentication)
  app.post("/api/process/epub", isAuthenticated, async (req: any, res) => {
    try {
      console.log("[EPUB Upload] Starting processing for:", req.body.filename);
      const { uploadedURL, filename } = req.body;
      if (!uploadedURL || !filename) {
        console.error("[EPUB Upload] Missing required fields");
        return res.status(400).json({ error: "Missing uploadedURL or filename" });
      }

      const userId = req.user.claims.sub;
      console.log("[EPUB Upload] User ID:", userId);
      const objectStorageService = new ObjectStorageService();
      
      // Normalize the Object Storage path
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadedURL);
      console.log("[EPUB Upload] Downloading from Object Storage:", objectPath);
      
      // Download the file from Object Storage to process it
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const tempFilePath = path.join(uploadDir, `temp-${Date.now()}-${filename}`);
      
      // Download to temp location for processing
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempFilePath);
        const readStream = objectFile.createReadStream();
        readStream.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
        readStream.on('error', reject);
      });
      console.log("[EPUB Upload] Download complete, computing hash");
      const [fileStats, contentHash] = await Promise.all([
        fs.promises.stat(tempFilePath),
        computeFileHash(tempFilePath),
      ]);

      // Check for duplicate uploads before doing heavy parsing
      const existing = await storage.findEpubByHash(userId, contentHash);
      if (existing) {
        console.log("[EPUB Upload] Duplicate detected, reusing book", existing.id);
        await objectStorageService.trySetObjectEntityAclPolicy(uploadedURL, {
          owner: userId,
          visibility: "private",
        });
        await fs.promises.unlink(tempFilePath);
        return res.json(existing);
      }

      console.log("[EPUB Upload] Parsing EPUB");
      const parsed = await parseEpub(tempFilePath);
      console.log("[EPUB Upload] Parsed:", parsed.title, "by", parsed.author);

      await fs.promises.unlink(tempFilePath);

      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(uploadedURL, {
        owner: userId,
        visibility: "private", // EPUBs are private to the user
      });
      console.log("[EPUB Upload] ACL set, creating database record");

      const epubBook = await storage.createEpubBook({
        userId,
        title: parsed.title,
        author: parsed.author,
        filename,
        textContent: parsed.textContent,
        chapters: parsed.chapters,
        htmlChapters: parsed.htmlChapters,
        objectStoragePath: normalizedPath,
        contentHash,
        fileSizeBytes: fileStats.size,
      });
      console.log("[EPUB Upload] SUCCESS - Created book with ID:", epubBook.id);

      res.json(epubBook);
    } catch (error: any) {
      console.error("[EPUB Upload] FAILED:", error);
      console.error("[EPUB Upload] Error stack:", error.stack);
      res.status(500).json({ error: error.message || "Failed to process EPUB" });
    }
  });

  // Process audiobook after upload to Object Storage (requires authentication)
  app.post("/api/process/audio", isAuthenticated, async (req: any, res) => {
    let tempFilePath: string | null = null;
    try {
      console.log("[Audio Upload] Starting processing for:", req.body.filename);
      const { uploadedURL, filename } = req.body;
      if (!uploadedURL || !filename) {
        console.error("[Audio Upload] Missing required fields");
        return res.status(400).json({ error: "Missing uploadedURL or filename" });
      }

      const userId = req.user.claims.sub;
      console.log("[Audio Upload] User ID:", userId);
      const objectStorageService = new ObjectStorageService();
      
      // Normalize the Object Storage path
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadedURL);
      console.log("[Audio Upload] Downloading from Object Storage:", objectPath);
      
      // Download the file from Object Storage to process it
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      tempFilePath = path.join(uploadDir, `temp-${Date.now()}-${filename}`);
      
      // Download to temp location for processing
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempFilePath!);
        const readStream = objectFile.createReadStream();
        readStream.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
        readStream.on('error', reject);
      });
      console.log("[Audio Upload] Download complete, computing hash");
      const [fileStats, contentHash] = await Promise.all([
        fs.promises.stat(tempFilePath),
        computeFileHash(tempFilePath),
      ]);

      // Check for duplicate uploads before metadata extraction
      const existing = await storage.findAudiobookByHash(userId, contentHash);
      if (existing) {
        console.log("[Audio Upload] Duplicate detected, reusing audiobook", existing.id);
        await objectStorageService.trySetObjectEntityAclPolicy(uploadedURL, {
          owner: userId,
          visibility: "private",
        });
        return res.json(existing);
      }

      console.log("[Audio Upload] Extracting metadata");
      const metadata = await parseFile(tempFilePath);
      const duration = metadata.format.duration || 0;
      console.log("[Audio Upload] Duration:", duration, "seconds");

      // Set ACL policy for the uploaded file
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(uploadedURL, {
        owner: userId,
        visibility: "private", // Audiobooks are private to the user
      });
      console.log("[Audio Upload] ACL set, creating database record");

      // Create audiobook record
      const audiobook = await storage.createAudiobook({
        userId,
        filename,
        duration,
        format: path.extname(filename).substring(1),
        filePath: normalizedPath, // Use object storage path as fallback for legacy field
        objectStoragePath: normalizedPath,
        contentHash,
        fileSizeBytes: fileStats.size,
      });
      console.log("[Audio Upload] SUCCESS - Created audiobook with ID:", audiobook.id);

      res.json(audiobook);
    } catch (error: any) {
      console.error("[Audio Upload] FAILED:", error);
      console.error("[Audio Upload] Error stack:", error.stack);
      res.status(500).json({ error: error.message || "Failed to process audiobook" });
    } finally {
      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Failed to cleanup temp audio file:", cleanupError);
        }
      }
    }
  });

  // Get user's EPUB books (requires authentication)
  app.get('/api/library/epubs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const books = await storage.getUserEpubBooks(userId);
      res.json(books);
    } catch (error) {
      console.error("Error fetching user books:", error);
      res.status(500).json({ message: "Failed to fetch books" });
    }
  });

  // Get user's audiobooks (requires authentication)
  app.get('/api/library/audiobooks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const audiobooks = await storage.getUserAudiobooks(userId);
      res.json(audiobooks);
    } catch (error) {
      console.error("Error fetching user audiobooks:", error);
      res.status(500).json({ message: "Failed to fetch audiobooks" });
    }
  });

  // Get a single EPUB by ID (for standalone reading)
  app.get('/api/library/epubs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const epub = await storage.getEpubBook(id);
      
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }
      
      // Verify ownership
      if (epub.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      res.json(epub);
    } catch (error) {
      console.error("Error fetching EPUB:", error);
      res.status(500).json({ message: "Failed to fetch EPUB" });
    }
  });

  // Reprocess EPUB to extract HTML/CSS formatting
  app.post('/api/library/epubs/:id/reprocess', isAuthenticated, async (req: any, res) => {
    let tempFilePath: string | null = null;
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const epub = await storage.getEpubBook(id);
      
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }
      
      // Verify ownership
      if (epub.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const objectStorageService = new ObjectStorageService();
      
      // Download the EPUB from Object Storage
      const objectPath = objectStorageService.normalizeObjectEntityPath(epub.objectStoragePath!);
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      tempFilePath = path.join(uploadDir, `reprocess-${Date.now()}-${epub.filename}`);
      
      // Download to temp location for processing
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempFilePath!);
        const readStream = objectFile.createReadStream();
        readStream.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
        readStream.on('error', reject);
      });
      
      // Re-parse the EPUB to extract HTML/CSS
      const parsed = await parseEpub(tempFilePath);
      
      // Update the EPUB book record with new HTML chapters
      const updatedEpub = await storage.updateEpubBook(id, {
        htmlChapters: parsed.htmlChapters,
      });
      
      res.json(updatedEpub);
    } catch (error) {
      console.error("Error reprocessing EPUB:", error);
      res.status(500).json({ message: "Failed to reprocess EPUB" });
    } finally {
      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  // Get a single audiobook by ID (for standalone listening)
  app.get('/api/library/audiobooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const audiobook = await storage.getAudiobook(id);
      
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      // Verify ownership
      if (audiobook.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      res.json(audiobook);
    } catch (error) {
      console.error("Error fetching audiobook:", error);
      res.status(500).json({ message: "Failed to fetch audiobook" });
    }
  });

  // Stream audiobook audio with range support
  app.get('/api/library/audiobooks/:id/stream', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const audiobook = await storage.getAudiobook(id);
      
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      // Verify ownership
      if (audiobook.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Get the audio file from Object Storage
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(audiobook.objectStoragePath || audiobook.filePath);
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Set proper MIME type based on file format
      const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4',
        'm4b': 'audio/mp4',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
      };
      
      const mimeType = mimeTypes[audiobook.format.toLowerCase()] || 'audio/mpeg';
      
      // Get file metadata for size
      const [metadata] = await objectFile.getMetadata();
      const fileSize = Number(metadata.size) || 0;
      
      // Handle range requests for seeking/resume (RFC 7233 compliant)
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        let start: number;
        let end: number;
        
        // Handle different range formats
        if (parts[0] === '') {
          // Suffix range: bytes=-500 (last 500 bytes)
          const suffix = parseInt(parts[1], 10);
          if (isNaN(suffix) || suffix <= 0) {
            res.status(416).set('Content-Range', `bytes */${fileSize}`);
            return res.send('Range Not Satisfiable');
          }
          start = Math.max(0, fileSize - suffix);
          end = fileSize - 1;
        } else {
          // Normal or start-only range
          start = parseInt(parts[0], 10);
          if (isNaN(start) || start < 0) {
            res.status(416).set('Content-Range', `bytes */${fileSize}`);
            return res.send('Range Not Satisfiable');
          }
          
          end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          if (isNaN(end)) {
            end = fileSize - 1;
          }
        }
        
        // Validate and clamp range
        start = Math.max(0, start);
        end = Math.min(end, fileSize - 1);
        
        if (start > end || start >= fileSize) {
          res.status(416).set('Content-Range', `bytes */${fileSize}`);
          return res.send('Range Not Satisfiable');
        }
        
        const chunkSize = (end - start) + 1;
        
        // Set 206 Partial Content headers
        res.status(206);
        res.set({
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Cache-Control': 'private, max-age=3600',
        });
        
        // Create read stream with range
        const stream = objectFile.createReadStream({ start, end });
        stream.on('error', (err) => {
          console.error('Audio stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming audio' });
          }
        });
        
        stream.pipe(res);
      } else {
        // No range requested, stream entire file
        res.set({
          'Content-Type': mimeType,
          'Content-Length': fileSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        });
        
        const stream = objectFile.createReadStream();
        stream.on('error', (err) => {
          console.error('Audio stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming audio' });
          }
        });
        
        stream.pipe(res);
      }
    } catch (error: any) {
      console.error("Error streaming audiobook:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Failed to stream audiobook" });
      }
    }
  });

  // Update EPUB title
  app.patch('/api/library/epubs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { title } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const epub = await storage.getEpubBook(id);
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }
      
      if (epub.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const updated = await storage.updateEpubBook(id, { title });
      res.json(updated);
    } catch (error) {
      console.error("Error updating EPUB title:", error);
      res.status(500).json({ message: "Failed to update EPUB title" });
    }
  });

  // Update audiobook title
  app.patch('/api/library/audiobooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { title } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const audiobook = await storage.getAudiobook(id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      if (audiobook.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const updated = await storage.updateAudiobook(id, { title });
      res.json(updated);
    } catch (error) {
      console.error("Error updating audiobook title:", error);
      res.status(500).json({ message: "Failed to update audiobook title" });
    }
  });

  // Delete EPUB and associated sync sessions
  app.delete('/api/library/epubs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const epub = await storage.getEpubBook(id);
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }
      
      if (epub.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Delete associated sync sessions
      await storage.deleteSyncSessionsByEpub(id);
      
      // Delete the EPUB
      await storage.deleteEpubBook(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting EPUB:", error);
      res.status(500).json({ message: "Failed to delete EPUB" });
    }
  });

  // Delete audiobook and associated sync sessions
  app.delete('/api/library/audiobooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      
      const audiobook = await storage.getAudiobook(id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      
      if (audiobook.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      // Delete associated sync sessions
      await storage.deleteSyncSessionsByAudiobook(id);
      
      // Delete the audiobook
      await storage.deleteAudiobook(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting audiobook:", error);
      res.status(500).json({ message: "Failed to delete audiobook" });
    }
  });
  
  // Upload EPUB file (requires authentication)
  app.post("/api/upload/epub", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const filePath = req.file.path;
      const [fileStats, contentHash] = await Promise.all([
        fs.promises.stat(filePath),
        computeFileHash(filePath),
      ]);

      const existing = await storage.findEpubByHash(userId, contentHash);
      if (existing) {
        await fs.promises.unlink(filePath).catch(() => undefined);
        return res.json(existing);
      }

      const parsed = await parseEpub(filePath);

      const epubBook = await storage.createEpubBook({
        userId,
        title: parsed.title,
        author: parsed.author,
        filename: req.file.originalname,
        textContent: parsed.textContent,
        chapters: parsed.chapters,
        htmlChapters: parsed.htmlChapters,
        objectStoragePath: filePath,
        contentHash,
        fileSizeBytes: fileStats.size,
      });

      res.json(epubBook);
    } catch (error: any) {
      console.error("EPUB upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process EPUB" });
    }
  });

  // Upload audiobook file (requires authentication)
  app.post("/api/upload/audio", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const filePath = req.file.path;
      
      // Get audio metadata
      const [fileStats, contentHash] = await Promise.all([
        fs.promises.stat(filePath),
        computeFileHash(filePath),
      ]);

      const existing = await storage.findAudiobookByHash(userId, contentHash);
      if (existing) {
        await fs.promises.unlink(filePath).catch(() => undefined);
        return res.json(existing);
      }

      const metadata = await parseFile(filePath);
      const duration = metadata.format.duration || 0;

      const audiobook = await storage.createAudiobook({
        userId,
        filename: req.file.originalname,
        duration,
        format: path.extname(req.file.originalname).substring(1),
        filePath: req.file.path,
        objectStoragePath: req.file.path,
        contentHash,
        fileSizeBytes: fileStats.size,
      });

      res.json(audiobook);
    } catch (error: any) {
      console.error("Audio upload error:", error);
      res.status(500).json({ error: error.message || "Failed to process audiobook" });
    }
  });

  // Create sync session and start processing (requires authentication)
  app.post("/api/sync/create", isAuthenticated, async (req: any, res) => {
    try {
      const { epubId, audioId, syncMode = "progressive", wordChunkSize = 1000 } = req.body;

      if (!epubId || !audioId) {
        return res.status(400).json({ error: "Missing epubId or audioId" });
      }

      const userId = req.user.claims.sub;

      // Check if session already exists for this user
      const existing = await storage.getSyncSessionByFiles(epubId, audioId, userId);
      if (existing) {
        return res.json(existing);
      }

      const session = await storage.createSyncSession({
        userId,
        epubId,
        audioId,
        status: "pending",
        progress: 0,
        currentStep: "extracting",
        syncMode: syncMode as "full" | "progressive",
        wordChunkSize,
        progressVersion: 1,
        playbackPositionSec: 0,
        playbackProgress: 0,
        playbackUpdatedAt: new Date(),
      });

      // Start async processing based on sync mode
      if (syncMode === "progressive") {
        const { startProgressiveSync } = await import("./utils/progressive-sync");
        startProgressiveSync(session.id).catch(console.error);
      } else {
        processSync(session.id).catch(console.error);
      }

      res.json(session);
    } catch (error: any) {
      console.error("Sync creation error:", error);
      res.status(500).json({ error: error.message || "Failed to create sync session" });
    }
  });

  // Get user's sync sessions (requires authentication)
  app.get("/api/library/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserSyncSessions(userId);
      res.json(sessions);
    } catch (error: any) {
      console.error("Error fetching user sessions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch sessions" });
    }
  });

  // Get user's sync sessions (alternate endpoint for Library UI)
  app.get("/api/sync-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserSyncSessions(userId);
      res.json(sessions);
    } catch (error: any) {
      console.error("Error fetching user sync sessions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch sync sessions" });
    }
  });

  // Delete sync session (requires authentication)
  app.delete("/api/sync-sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;

      // Load the session to verify ownership
      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Sync session not found" });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to delete this sync session" });
      }

      // Delete the session
      await storage.deleteSyncSession(sessionId);

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting sync session:", error);
      res.status(500).json({ error: error.message || "Failed to delete sync session" });
    }
  });

  // Retry a failed sync session (requires authentication)
  app.post("/api/sync/:id/retry", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;

      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Only retry if session is in error state
      if (session.status !== "error") {
        return res.status(400).json({ error: "Can only retry failed sessions" });
      }

      // Reset session to pending state
      const resetSession = await storage.updateSyncSession(sessionId, {
        status: "pending",
        progress: 0,
        currentStep: "extracting",
        error: null,
      });

      if (!resetSession) {
        return res.status(500).json({ error: "Failed to reset session" });
      }

      // Start async processing based on sync mode
      if (resetSession.syncMode === "progressive") {
        const { startProgressiveSync } = await import("./utils/progressive-sync");
        startProgressiveSync(sessionId).catch(console.error);
      } else {
        processSync(sessionId).catch(console.error);
      }

      res.json(resetSession);
    } catch (error: any) {
      console.error("Sync retry error:", error);
      res.status(500).json({ error: error.message || "Failed to retry sync" });
    }
  });

  // Persist playback progress (requires authentication)
  app.post("/api/sync/:id/progress", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;
      const { positionSec, durationSec, progressVersion } = req.body ?? {};

      if (typeof positionSec !== "number" || Number.isNaN(positionSec) || positionSec < 0) {
        return res.status(400).json({ error: "positionSec must be a positive number" });
      }

      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const safeDuration =
        typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0
          ? durationSec
          : undefined;

      const playbackPositionSec = safeDuration
        ? Math.min(positionSec, safeDuration)
        : positionSec;

      const playbackProgress = safeDuration
        ? Math.min(100, Math.max(0, (playbackPositionSec / safeDuration) * 100))
        : 0;

      const updates: Partial<SyncSession> = {
        playbackPositionSec,
        playbackProgress,
        playbackUpdatedAt: new Date(),
      };

      if (
        typeof progressVersion === "number" &&
        Number.isFinite(progressVersion) &&
        progressVersion > (session.progressVersion ?? 1)
      ) {
        updates.progressVersion = Math.floor(progressVersion);
      }

      const updated = await storage.updateSyncSession(sessionId, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to persist playback progress:", error);
      res.status(500).json({ error: error.message || "Failed to persist progress" });
    }
  });

  // Advance progressive sync to next chunk (requires authentication)
  app.post("/api/sync/:id/advance", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;

      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if session uses progressive sync
      if (session.syncMode !== "progressive") {
        return res.status(400).json({ error: "Session is not in progressive sync mode" });
      }

      // Check if there's more content to sync
      const epub = await storage.getEpubBook(session.epubId);
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }

      const wordMap = epub.textContent.split(/\s+/);
      const totalWords = wordMap.length;
      const currentProgress = session.syncedUpToWord || 0;

      if (currentProgress >= totalWords) {
        return res.status(400).json({ error: "Sync already complete" });
      }

      // Trigger next chunk sync in background
      const chunkSize = session.wordChunkSize || 1000;
      const { syncWordChunk } = await import("./utils/progressive-sync");
      syncWordChunk(sessionId, currentProgress, chunkSize).catch(console.error);

      res.json({ 
        success: true, 
        message: "Next chunk sync started",
        syncedUpToWord: currentProgress,
        nextChunkEnd: Math.min(currentProgress + chunkSize, totalWords),
      });
    } catch (error: any) {
      console.error("Sync advance error:", error);
      res.status(500).json({ error: error.message || "Failed to advance sync" });
    }
  });

  // Pause progressive sync (requires authentication)
  app.post("/api/sync/:id/pause", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;

      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if session uses progressive sync
      if (session.syncMode !== "progressive") {
        return res.status(400).json({ error: "Session is not in progressive sync mode" });
      }

      // Mark session as paused to stop further auto-advance
      const updatedSession = await storage.updateSyncSession(sessionId, {
        status: "paused",
      });

      res.json({ 
        success: true, 
        message: "Sync paused",
        session: updatedSession,
      });
    } catch (error: any) {
      console.error("Sync pause error:", error);
      res.status(500).json({ error: error.message || "Failed to pause sync" });
    }
  });

  // Resume progressive sync (requires authentication)
  app.post("/api/sync/:id/resume", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;

      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if session uses progressive sync
      if (session.syncMode !== "progressive") {
        return res.status(400).json({ error: "Session is not in progressive sync mode" });
      }

      // Check if session is paused
      if (session.status !== "paused") {
        return res.status(400).json({ error: "Session is not paused" });
      }

      // Resume sync by setting status back to processing
      const updatedSession = await storage.updateSyncSession(sessionId, {
        status: "processing",
      });

      // Trigger next chunk sync to restart progress
      const epub = await storage.getEpubBook(session.epubId);
      if (epub) {
        const totalWords = epub.textContent.split(/\s+/).length;
        const currentProgress = session.syncedUpToWord || 0;
        
        if (currentProgress < totalWords) {
          const chunkSize = session.wordChunkSize || 1000;
          const { syncWordChunk } = await import("./utils/progressive-sync");
          syncWordChunk(sessionId, currentProgress, chunkSize).catch(console.error);
        }
      }

      res.json({ 
        success: true, 
        message: "Sync resumed",
        session: updatedSession,
      });
    } catch (error: any) {
      console.error("Sync resume error:", error);
      res.status(500).json({ error: error.message || "Failed to resume sync" });
    }
  });

  // Delete sync session (requires authentication)
  app.delete("/api/sync/:id", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const userId = req.user.claims.sub;

      const session = await storage.getSyncSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Delete the session
      await storage.deleteSyncSession(sessionId);

      res.json({ 
        success: true, 
        message: "Sync session deleted",
      });
    } catch (error: any) {
      console.error("Sync delete error:", error);
      res.status(500).json({ error: error.message || "Failed to delete sync session" });
    }
  });

  // Get EPUB by ID (requires authentication)
  app.get("/api/epub/:id", isAuthenticated, async (req, res) => {
    try {
      const epub = await storage.getEpubBook(req.params.id);
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }
      res.json(epub);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get EPUB" });
    }
  });

  // Get audiobook by ID (requires authentication)
  app.get("/api/audiobook/:id", isAuthenticated, async (req, res) => {
    try {
      const audiobook = await storage.getAudiobook(req.params.id);
      if (!audiobook) {
        return res.status(404).json({ error: "Audiobook not found" });
      }
      res.json(audiobook);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get audiobook" });
    }
  });

  // Get sync session status (requires authentication)
  app.get("/api/sync/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getSyncSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get session" });
    }
  });

  // Get sync point for current audio time (requires authentication)
  app.get("/api/sync/:id/position", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getSyncSession(req.params.id);
      if (!session || !session.syncAnchors) {
        return res.status(404).json({ error: "Session not found or not synced" });
      }
      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const audioTime = parseFloat(req.query.time as string);
      if (isNaN(audioTime)) {
        return res.status(400).json({ error: "Invalid time parameter" });
      }

      const epub = await storage.getEpubBook(session.epubId);
      if (!epub) {
        return res.status(404).json({ error: "EPUB not found" });
      }

      const syncPoints = session.syncAnchors.map((a) => ({
        audioTime: a.audioTime,
        textIndex: a.textIndex,
      }));

      // Find sentence index from character index
      const sentences = epub.textContent.match(/[^.!?]+[.!?]+/g) || [epub.textContent];
      let currentIndex = 0;
      let sentenceIndex = 0;

      // Interpolate to find current text position
      const textIndex = interpolatePosition(syncPoints, audioTime);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        currentIndex += sentence.length + 1;
        if (currentIndex >= textIndex) {
          sentenceIndex = i;
          break;
        }
      }

      res.json({ sentenceIndex, textIndex });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get position" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function for interpolation
function interpolatePosition(
  syncPoints: { audioTime: number; textIndex: number }[],
  audioTime: number
): number {
  if (syncPoints.length === 0) return 0;
  if (syncPoints.length === 1) return syncPoints[0].textIndex;

  let before = syncPoints[0];
  let after = syncPoints[syncPoints.length - 1];

  for (let i = 0; i < syncPoints.length - 1; i++) {
    if (audioTime >= syncPoints[i].audioTime && audioTime <= syncPoints[i + 1].audioTime) {
      before = syncPoints[i];
      after = syncPoints[i + 1];
      break;
    }
  }

  const timeDiff = after.audioTime - before.audioTime;
  const textDiff = after.textIndex - before.textIndex;

  if (timeDiff === 0) return before.textIndex;

  const ratio = (audioTime - before.audioTime) / timeDiff;
  return Math.round(before.textIndex + ratio * textDiff);
}

// Background sync processing
async function processSync(sessionId: string) {
  try {
    await storage.updateSyncSession(sessionId, {
      status: "processing",
      currentStep: "extracting",
      progress: 10,
    });

    const session = await storage.getSyncSession(sessionId);
    if (!session) return;

    const epub = await storage.getEpubBook(session.epubId);
    const audio = await storage.getAudiobook(session.audioId);

    if (!epub || !audio) {
      await storage.updateSyncSession(sessionId, {
        status: "error",
        error: "EPUB or audiobook not found",
      });
      return;
    }

    // Step 2: Prepare for transcription
    await storage.updateSyncSession(sessionId, {
      currentStep: "segmenting",
      progress: 20,
    });

    // Step 3: Transcribe audio (with automatic chunking if needed)
    await storage.updateSyncSession(sessionId, {
      currentStep: "transcribing",
      progress: 30,
    });

    // Download audio file from Object Storage if needed
    let audioFilePath = audio.filePath;
    let needsCleanup = false;
    
    if (audio.objectStoragePath) {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(audio.objectStoragePath);
      const tempPath = path.join(uploadDir, `temp-audio-${sessionId}.${audio.format}`);
      
      // Download to temp location for processing
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(tempPath);
        const readStream = objectFile.createReadStream();
        readStream.pipe(writeStream);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
        readStream.on('error', reject);
      });
      
      audioFilePath = tempPath;
      needsCleanup = true;
    }

    try {
      const transcriptionResult = await transcribeWithChunking(
        audioFilePath,
        sessionId, // Use session ID to create unique chunk directory
        // onInit: called once with total chunk count
        async (totalChunks) => {
          await storage.updateSyncSession(sessionId, {
            totalChunks,
            currentChunk: 0,
            progress: 35,
          });
        },
        // onProgress: called after each chunk is processed
        async (currentChunk, totalChunks) => {
          const chunkProgress = 35 + Math.floor((currentChunk / totalChunks) * 35);
          await storage.updateSyncSession(sessionId, {
            currentChunk,
            totalChunks,
            progress: chunkProgress,
          });
        }
      );

      // Clean up temp file if we downloaded it
      if (needsCleanup && fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }

      // Step 4: Match text with transcription
      await storage.updateSyncSession(sessionId, {
        currentStep: "matching",
        progress: 75,
      });

      // Find text matches using all chunk transcriptions
      // Format chunks as expected by findTextMatches
      const formattedTranscriptions = transcriptionResult.chunks.map(chunk => ({
        text: chunk.text,
        timestamp: chunk.startTime,
      }));

      const matches = findTextMatches(epub.textContent, formattedTranscriptions);

      // Ensure we have anchors at start and end
      const allMatches = [...matches];
      
      if (allMatches.length === 0 || allMatches[0].audioTime > 0) {
        allMatches.unshift({ audioTime: 0, textIndex: 0, confidence: 1.0 });
      }
      if (allMatches[allMatches.length - 1]?.audioTime < audio.duration) {
        allMatches.push({ 
          audioTime: audio.duration, 
          textIndex: epub.textContent.length, 
          confidence: 1.0 
        });
      }

      // Calculate final sync points
      const syncPoints = calculateSyncPoints(allMatches, audio.duration, epub.textContent.length);

      await storage.updateSyncSession(sessionId, {
        status: "complete",
        currentStep: "complete",
        progress: 100,
        syncAnchors: syncPoints.map(p => ({ ...p, confidence: 0.9 })),
      });
    } catch (transcriptionError) {
      // Clean up temp file on error too
      if (needsCleanup && fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
      throw transcriptionError;
    }
  } catch (error: any) {
    console.error("Sync processing error:", error);
    await storage.updateSyncSession(sessionId, {
      status: "error",
      error: error.message || "Processing failed",
    });
  }
}

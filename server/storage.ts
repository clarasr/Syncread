
import {
  type User,
  type UpsertUser,
  type EpubBook,
  type InsertEpubBook,
  type Audiobook,
  type InsertAudiobook,
  type SyncSession,
  type InsertSyncSession,
  users,
  epubBooks,
  audiobooks,
  syncSessions,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // EPUB Book methods
  createEpubBook(book: InsertEpubBook): Promise<EpubBook>;
  findEpubByHash(userId: string, contentHash: string): Promise<EpubBook | undefined>;
  getEpubBook(id: string): Promise<EpubBook | undefined>;
  getAllEpubBooks(): Promise<EpubBook[]>;
  getUserEpubBooks(userId: string): Promise<EpubBook[]>;
  updateEpubBook(id: string, updates: Partial<EpubBook>): Promise<EpubBook | undefined>;
  deleteEpubBook(id: string): Promise<void>;

  // Audiobook methods
  createAudiobook(audiobook: InsertAudiobook): Promise<Audiobook>;
  findAudiobookByHash(userId: string, contentHash: string): Promise<Audiobook | undefined>;
  getAudiobook(id: string): Promise<Audiobook | undefined>;
  getAllAudiobooks(): Promise<Audiobook[]>;
  getUserAudiobooks(userId: string): Promise<Audiobook[]>;
  updateAudiobook(id: string, updates: Partial<Audiobook>): Promise<Audiobook | undefined>;
  deleteAudiobook(id: string): Promise<void>;

  // Sync Session methods
  createSyncSession(session: InsertSyncSession): Promise<SyncSession>;
  getSyncSession(id: string): Promise<SyncSession | undefined>;
  updateSyncSession(id: string, updates: Partial<SyncSession>): Promise<SyncSession | undefined>;
  getSyncSessionByFiles(epubId: string, audioId: string, userId: string): Promise<SyncSession | undefined>;
  getUserSyncSessions(userId: string): Promise<SyncSession[]>;
  deleteSyncSessionsByEpub(epubId: string): Promise<void>;
  deleteSyncSessionsByAudiobook(audioId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private epubBooks: Map<string, EpubBook>;
  private audiobooks: Map<string, Audiobook>;
  private syncSessions: Map<string, SyncSession>;

  constructor() {
    this.users = new Map();
    this.epubBooks = new Map();
    this.audiobooks = new Map();
    this.syncSessions = new Map();
  }

  // User methods for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id || randomUUID();
    const existingUser = this.users.get(id);
    
    const user: User = {
      id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      createdAt: existingUser?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set(id, user);
    return user;
  }

  // EPUB Book methods
  async createEpubBook(insertBook: InsertEpubBook): Promise<EpubBook> {
    const existing = await this.findEpubByHash(insertBook.userId, insertBook.contentHash);
    if (existing) {
      return existing;
    }

    const book: EpubBook = {
      id: randomUUID(),
      userId: insertBook.userId,
      title: insertBook.title,
      author: insertBook.author ?? null,
      filename: insertBook.filename,
      textContent: insertBook.textContent,
      chapters: insertBook.chapters ?? null,
      htmlChapters: insertBook.htmlChapters ?? null,
      objectStoragePath: insertBook.objectStoragePath,
      contentHash: insertBook.contentHash,
      fileSizeBytes: insertBook.fileSizeBytes ?? null,
      createdAt: new Date(),
    };
    this.epubBooks.set(book.id, book);
    return book;
  }

  async findEpubByHash(userId: string, contentHash: string): Promise<EpubBook | undefined> {
    return Array.from(this.epubBooks.values()).find(
      (book) => book.userId === userId && book.contentHash === contentHash
    );
  }

  async getEpubBook(id: string): Promise<EpubBook | undefined> {
    return this.epubBooks.get(id);
  }

  async getAllEpubBooks(): Promise<EpubBook[]> {
    return Array.from(this.epubBooks.values());
  }

  async getUserEpubBooks(userId: string): Promise<EpubBook[]> {
    return Array.from(this.epubBooks.values()).filter(
      (book) => book.userId === userId
    );
  }

  async updateEpubBook(id: string, updates: Partial<EpubBook>): Promise<EpubBook | undefined> {
    const book = this.epubBooks.get(id);
    if (!book) return undefined;

    const updated = { ...book, ...updates };
    this.epubBooks.set(id, updated);
    return updated;
  }

  async deleteEpubBook(id: string): Promise<void> {
    this.epubBooks.delete(id);
  }

  // Audiobook methods
  async createAudiobook(insertAudiobook: InsertAudiobook): Promise<Audiobook> {
    const existing = await this.findAudiobookByHash(insertAudiobook.userId, insertAudiobook.contentHash);
    if (existing) {
      return existing;
    }

    const audiobook: Audiobook = {
      id: randomUUID(),
      userId: insertAudiobook.userId,
      title: insertAudiobook.title ?? null,
      filename: insertAudiobook.filename,
      duration: insertAudiobook.duration,
      format: insertAudiobook.format,
      filePath: insertAudiobook.filePath,
      objectStoragePath: insertAudiobook.objectStoragePath,
      contentHash: insertAudiobook.contentHash,
      fileSizeBytes: insertAudiobook.fileSizeBytes ?? null,
      createdAt: new Date(),
    };
    this.audiobooks.set(audiobook.id, audiobook);
    return audiobook;
  }

  async findAudiobookByHash(userId: string, contentHash: string): Promise<Audiobook | undefined> {
    return Array.from(this.audiobooks.values()).find(
      (audiobook) => audiobook.userId === userId && audiobook.contentHash === contentHash
    );
  }

  async getAudiobook(id: string): Promise<Audiobook | undefined> {
    return this.audiobooks.get(id);
  }

  async getAllAudiobooks(): Promise<Audiobook[]> {
    return Array.from(this.audiobooks.values());
  }

  async getUserAudiobooks(userId: string): Promise<Audiobook[]> {
    return Array.from(this.audiobooks.values()).filter(
      (audiobook) => audiobook.userId === userId
    );
  }

  async updateAudiobook(id: string, updates: Partial<Audiobook>): Promise<Audiobook | undefined> {
    const audiobook = this.audiobooks.get(id);
    if (!audiobook) return undefined;

    const updated = { ...audiobook, ...updates };
    this.audiobooks.set(id, updated);
    return updated;
  }

  async deleteAudiobook(id: string): Promise<void> {
    this.audiobooks.delete(id);
  }

  // Sync Session methods
  async createSyncSession(insertSession: InsertSyncSession): Promise<SyncSession> {
    const session: SyncSession = {
      id: randomUUID(),
      userId: insertSession.userId,
      epubId: insertSession.epubId,
      audioId: insertSession.audioId,
      status: insertSession.status,
      progress: insertSession.progress ?? null,
      currentStep: insertSession.currentStep ?? null,
      totalChunks: insertSession.totalChunks ?? null,
      currentChunk: insertSession.currentChunk ?? null,
      syncAnchors: insertSession.syncAnchors ?? null,
      syncMode: insertSession.syncMode ?? "full",
      syncedUpToWord: insertSession.syncedUpToWord ?? 0,
      wordChunkSize: insertSession.wordChunkSize ?? 1000,
      error: insertSession.error ?? null,
      progressVersion: insertSession.progressVersion ?? 1,
      playbackPositionSec: insertSession.playbackPositionSec ?? 0,
      playbackProgress: insertSession.playbackProgress ?? 0,
      playbackUpdatedAt: insertSession.playbackUpdatedAt ?? new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.syncSessions.set(session.id, session);
    return session;
  }

  async getSyncSession(id: string): Promise<SyncSession | undefined> {
    return this.syncSessions.get(id);
  }

  async updateSyncSession(
    id: string,
    updates: Partial<SyncSession>
  ): Promise<SyncSession | undefined> {
    const session = this.syncSessions.get(id);
    if (!session) return undefined;

    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    this.syncSessions.set(id, updated);
    return updated;
  }

  async getSyncSessionByFiles(
    epubId: string,
    audioId: string,
    userId: string
  ): Promise<SyncSession | undefined> {
    return Array.from(this.syncSessions.values()).find(
      (session) => session.epubId === epubId && session.audioId === audioId && session.userId === userId
    );
  }

  async getUserSyncSessions(userId: string): Promise<SyncSession[]> {
    return Array.from(this.syncSessions.values()).filter(
      (session) => session.userId === userId
    );
  }

  async deleteSyncSessionsByEpub(epubId: string): Promise<void> {
    for (const [id, session] of this.syncSessions.entries()) {
      if (session.epubId === epubId) {
        this.syncSessions.delete(id);
      }
    }
  }

  async deleteSyncSessionsByAudiobook(audioId: string): Promise<void> {
    for (const [id, session] of this.syncSessions.entries()) {
      if (session.audioId === audioId) {
        this.syncSessions.delete(id);
      }
    }
  }
}

// Database Storage Implementation using PostgreSQL
export class DbStorage implements IStorage {
  // User methods for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        id: userData.id || randomUUID(),
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // EPUB Book methods
  async createEpubBook(book: InsertEpubBook): Promise<EpubBook> {
    const existing = await this.findEpubByHash(book.userId, book.contentHash);
    if (existing) {
      return existing;
    }

    const result = await db
      .insert(epubBooks)
      .values({
        userId: book.userId,
        title: book.title,
        author: book.author,
        filename: book.filename,
        textContent: book.textContent,
        chapters: book.chapters,
        htmlChapters: book.htmlChapters,
        objectStoragePath: book.objectStoragePath,
        contentHash: book.contentHash,
        fileSizeBytes: book.fileSizeBytes,
      })
      .returning();
    return result[0];
  }

  async findEpubByHash(userId: string, contentHash: string): Promise<EpubBook | undefined> {
    const result = await db
      .select()
      .from(epubBooks)
      .where(and(eq(epubBooks.userId, userId), eq(epubBooks.contentHash, contentHash)))
      .limit(1);
    return result[0];
  }

  async getEpubBook(id: string): Promise<EpubBook | undefined> {
    const result = await db.select().from(epubBooks).where(eq(epubBooks.id, id)).limit(1);
    return result[0];
  }

  async getAllEpubBooks(): Promise<EpubBook[]> {
    return await db.select().from(epubBooks);
  }

  async getUserEpubBooks(userId: string): Promise<EpubBook[]> {
    return await db.select().from(epubBooks).where(eq(epubBooks.userId, userId));
  }

  async updateEpubBook(id: string, updates: Partial<EpubBook>): Promise<EpubBook | undefined> {
    const result = await db
      .update(epubBooks)
      .set(updates)
      .where(eq(epubBooks.id, id))
      .returning();
    return result[0];
  }

  async deleteEpubBook(id: string): Promise<void> {
    await db.delete(epubBooks).where(eq(epubBooks.id, id));
  }

  // Audiobook methods
  async createAudiobook(audiobook: InsertAudiobook): Promise<Audiobook> {
    const existing = await this.findAudiobookByHash(audiobook.userId, audiobook.contentHash);
    if (existing) {
      return existing;
    }

    const result = await db
      .insert(audiobooks)
      .values({
        userId: audiobook.userId,
        title: audiobook.title,
        filename: audiobook.filename,
        duration: audiobook.duration,
        format: audiobook.format,
        filePath: audiobook.filePath,
        objectStoragePath: audiobook.objectStoragePath,
        contentHash: audiobook.contentHash,
        fileSizeBytes: audiobook.fileSizeBytes,
      })
      .returning();
    return result[0];
  }

  async findAudiobookByHash(userId: string, contentHash: string): Promise<Audiobook | undefined> {
    const result = await db
      .select()
      .from(audiobooks)
      .where(and(eq(audiobooks.userId, userId), eq(audiobooks.contentHash, contentHash)))
      .limit(1);
    return result[0];
  }

  async getAudiobook(id: string): Promise<Audiobook | undefined> {
    const result = await db.select().from(audiobooks).where(eq(audiobooks.id, id)).limit(1);
    return result[0];
  }

  async getAllAudiobooks(): Promise<Audiobook[]> {
    return await db.select().from(audiobooks);
  }

  async getUserAudiobooks(userId: string): Promise<Audiobook[]> {
    return await db.select().from(audiobooks).where(eq(audiobooks.userId, userId));
  }

  async updateAudiobook(id: string, updates: Partial<Audiobook>): Promise<Audiobook | undefined> {
    const result = await db
      .update(audiobooks)
      .set(updates)
      .where(eq(audiobooks.id, id))
      .returning();
    return result[0];
  }

  async deleteAudiobook(id: string): Promise<void> {
    await db.delete(audiobooks).where(eq(audiobooks.id, id));
  }

  // Sync Session methods
  async createSyncSession(session: InsertSyncSession): Promise<SyncSession> {
    const result = await db
      .insert(syncSessions)
      .values({
        userId: session.userId,
        epubId: session.epubId,
        audioId: session.audioId,
        status: session.status,
        progress: session.progress,
        currentStep: session.currentStep,
        totalChunks: session.totalChunks,
        currentChunk: session.currentChunk,
        syncAnchors: session.syncAnchors,
        syncMode: session.syncMode,
        syncedUpToWord: session.syncedUpToWord,
        wordChunkSize: session.wordChunkSize,
        error: session.error,
        progressVersion: session.progressVersion,
        playbackPositionSec: session.playbackPositionSec,
        playbackProgress: session.playbackProgress,
        playbackUpdatedAt: session.playbackUpdatedAt,
      })
      .returning();
    return result[0];
  }

  async getSyncSession(id: string): Promise<SyncSession | undefined> {
    const result = await db.select().from(syncSessions).where(eq(syncSessions.id, id)).limit(1);
    return result[0];
  }

  async updateSyncSession(
    id: string,
    updates: Partial<SyncSession>
  ): Promise<SyncSession | undefined> {
    const result = await db
      .update(syncSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(syncSessions.id, id))
      .returning();
    return result[0];
  }

  async getSyncSessionByFiles(
    epubId: string,
    audioId: string,
    userId: string
  ): Promise<SyncSession | undefined> {
    const result = await db
      .select()
      .from(syncSessions)
      .where(
        and(
          eq(syncSessions.epubId, epubId),
          eq(syncSessions.audioId, audioId),
          eq(syncSessions.userId, userId)
        )
      )
      .limit(1);
    return result[0];
  }

  async getUserSyncSessions(userId: string): Promise<SyncSession[]> {
    return await db.select().from(syncSessions).where(eq(syncSessions.userId, userId));
  }

  async deleteSyncSessionsByEpub(epubId: string): Promise<void> {
    await db.delete(syncSessions).where(eq(syncSessions.epubId, epubId));
  }

  async deleteSyncSessionsByAudiobook(audioId: string): Promise<void> {
    await db.delete(syncSessions).where(eq(syncSessions.audioId, audioId));
  }
}

export const storage = new DbStorage();

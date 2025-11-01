import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// EPUB Books
export const epubBooks = pgTable("epub_books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  filename: text("filename").notNull(),
  textContent: text("text_content").notNull(),
  chapters: jsonb("chapters").$type<{ title: string; startIndex: number; endIndex: number; wordCount?: number }[]>(),
  htmlChapters: jsonb("html_chapters").$type<{ title: string; html: string; css?: string }[]>(), // Preserve EPUB formatting
  objectStoragePath: text("object_storage_path"), // Path in Object Storage (e.g., /objects/uploads/xxx.epub)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEpubBookSchema = createInsertSchema(epubBooks).omit({
  id: true,
  createdAt: true,
});

export type InsertEpubBook = z.infer<typeof insertEpubBookSchema>;
export type EpubBook = typeof epubBooks.$inferSelect;

// Audiobooks
export const audiobooks = pgTable("audiobooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title"), // Optional custom title
  filename: text("filename").notNull(),
  duration: real("duration").notNull(),
  format: text("format").notNull(),
  filePath: text("file_path").notNull(), // Legacy: local filesystem path
  objectStoragePath: text("object_storage_path"), // Path in Object Storage (e.g., /objects/uploads/xxx.mp3)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAudiobookSchema = createInsertSchema(audiobooks).omit({
  id: true,
  createdAt: true,
});

export type InsertAudiobook = z.infer<typeof insertAudiobookSchema>;
export type Audiobook = typeof audiobooks.$inferSelect;

// Sync Sessions
export const syncSessions = pgTable("sync_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  epubId: varchar("epub_id").notNull(),
  audioId: varchar("audio_id").notNull(),
  status: text("status").notNull().$type<"pending" | "processing" | "complete" | "error" | "paused">(),
  progress: integer("progress").default(0),
  currentStep: text("current_step").$type<"extracting" | "segmenting" | "transcribing" | "matching" | "complete">(),
  totalChunks: integer("total_chunks").default(1),
  currentChunk: integer("current_chunk").default(0),
  syncAnchors: jsonb("sync_anchors").$type<{ audioTime: number; textIndex: number; confidence: number }[]>(),
  syncMode: text("sync_mode").default("full").$type<"full" | "progressive">(),
  syncedUpToWord: integer("synced_up_to_word").default(0),
  wordChunkSize: integer("word_chunk_size").default(1000),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSyncSessionSchema = createInsertSchema(syncSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSyncSession = z.infer<typeof insertSyncSessionSchema>;
export type SyncSession = typeof syncSessions.$inferSelect;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIndex: index("IDX_session_expire").on(table.expire),
  })
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

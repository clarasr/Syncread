import AdmZip from "adm-zip";
import { load } from "cheerio";
import path from "path";

export interface ParsedEpub {
  title: string;
  author?: string;
  textContent: string;
  chapters: { title: string; startIndex: number; endIndex: number; wordCount: number }[];
  htmlChapters: { title: string; html: string; css?: string }[];
}

export async function parseEpub(filePath: string): Promise<ParsedEpub> {
  const zip = new AdmZip(filePath);
  const zipEntries = zip.getEntries();

  // Find content.opf to get metadata and spine
  const opfEntry = zipEntries.find(
    (entry: AdmZip.IZipEntry) =>
      entry.entryName.endsWith(".opf") || entry.entryName.includes("content.opf")
  );

  if (!opfEntry) {
    throw new Error("Invalid EPUB: No OPF file found");
  }

  const opfContent = opfEntry.getData().toString("utf8");
  const opf$ = load(opfContent, { xmlMode: true });

  // Extract metadata
  const title = opf$("metadata title").first().text() || "Unknown Title";
  const author = opf$("metadata creator").first().text() || undefined;

  // Get spine order
  const spineItems = opf$("spine itemref")
    .map((_, el) => opf$(el).attr("idref"))
    .get();

  // Build manifest map
  const manifestMap = new Map<string, string>();
  opf$("manifest item").each((_, el) => {
    const id = opf$(el).attr("id");
    const href = opf$(el).attr("href");
    if (id && href) {
      manifestMap.set(id, href);
    }
  });

  // Extract text content and HTML from spine order
  const chapters: { title: string; startIndex: number; endIndex: number; wordCount: number }[] = [];
  const htmlChapters: { title: string; html: string; css?: string }[] = [];
  let fullText = "";
  const opfDir = path.dirname(opfEntry.entryName);

  for (const itemId of spineItems) {
    const href = manifestMap.get(itemId);
    if (!href) continue;

    const contentPath = path.join(opfDir, href).replace(/\\/g, "/");
    const contentEntry = zipEntries.find((e: AdmZip.IZipEntry) => e.entryName === contentPath);

    if (contentEntry && (contentEntry.entryName.endsWith(".xhtml") || contentEntry.entryName.endsWith(".html"))) {
      const htmlContent = contentEntry.getData().toString("utf8");
      const $ = load(htmlContent);
      
      // Helper function to resolve CSS url() references relative to a base directory
      const resolveCssUrls = (cssContent: string, baseDir: string): string => {
        const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
        return cssContent.replace(urlRegex, (match, url) => {
          // Skip absolute URLs and data URLs
          if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("//")) {
            return match;
          }
          
          // Remove querystring and fragment
          const cleanUrl = url.split(/[?#]/)[0];
          
          // Resolve relative path from the CSS file's directory
          let assetPath = path.join(baseDir, cleanUrl).replace(/\\/g, "/");
          
          // Try to find the asset
          let assetEntry = zipEntries.find((e: AdmZip.IZipEntry) => e.entryName === assetPath);
          
          // If not found, try case-insensitive search
          if (!assetEntry) {
            const lowerPath = assetPath.toLowerCase();
            assetEntry = zipEntries.find((e: AdmZip.IZipEntry) => 
              e.entryName.toLowerCase() === lowerPath
            );
          }
          
          if (assetEntry) {
            const assetData = assetEntry.getData();
            const ext = path.extname(assetPath).toLowerCase();
            
            // Comprehensive MIME type mapping
            const mimeTypes: Record<string, string> = {
              // Fonts
              ".woff": "font/woff",
              ".woff2": "font/woff2",
              ".ttf": "font/ttf",
              ".otf": "font/otf",
              ".eot": "application/vnd.ms-fontobject",
              // Images
              ".jpg": "image/jpeg",
              ".jpeg": "image/jpeg",
              ".png": "image/png",
              ".gif": "image/gif",
              ".svg": "image/svg+xml",
              ".webp": "image/webp",
              ".bmp": "image/bmp",
              ".ico": "image/x-icon",
              // Other
              ".css": "text/css",
            };
            
            const mimeType = mimeTypes[ext] || "application/octet-stream";
            const base64 = assetData.toString("base64");
            return `url(data:${mimeType};base64,${base64})`;
          } else {
            console.warn(`EPUB asset not found: ${assetPath} (from url: ${url})`);
          }
          
          // If asset not found, keep original
          return match;
        });
      };
      
      // Extract CSS from style tags and linked stylesheets
      let css = "";
      
      // Extract and process inline styles (relative to HTML file)
      $("style").each((_, el) => {
        const inlineCss = $(el).html() || "";
        css += resolveCssUrls(inlineCss, path.dirname(contentPath)) + "\n";
      });
      
      // Extract and process linked stylesheets (relative to each CSS file)
      $("link[rel='stylesheet']").each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          const cssPath = path.join(path.dirname(contentPath), href).replace(/\\/g, "/");
          const cssEntry = zipEntries.find((e: AdmZip.IZipEntry) => e.entryName === cssPath);
          if (cssEntry) {
            const linkedCss = cssEntry.getData().toString("utf8");
            // Resolve URLs relative to the CSS file's directory
            css += resolveCssUrls(linkedCss, path.dirname(cssPath)) + "\n";
          }
        }
      });

      // For plain text extraction, remove script and style tags
      const $text = load(htmlContent);
      $text("script, style").remove();

      // Extract chapter title
      const chapterTitle =
        $("h1, h2").first().text().trim() || `Chapter ${chapters.length + 1}`;

      // Extract plain text for audio sync, preserving paragraph boundaries
      const startIndex = fullText.length;
      
      // Extract text from paragraph elements to preserve structure
      const paragraphs: string[] = [];
      $text("body").find("p, div.paragraph, div[class*='para']").each((_, el) => {
        const text = $text(el).text().replace(/\s+/g, " ").trim();
        if (text.length > 0) {
          paragraphs.push(text);
        }
      });
      
      // If no paragraphs found, fall back to extracting all text but preserve newlines
      let bodyText: string;
      if (paragraphs.length > 0) {
        bodyText = paragraphs.join("\n\n");
      } else {
        // Fallback: try to preserve line breaks from the HTML
        bodyText = $text("body").html() || "";
        // Replace block-level elements with double newlines
        bodyText = bodyText
          .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
          .replace(/<br\s*\/?>/gi, "\n");
        // Remove all remaining HTML tags
        bodyText = $text.load(bodyText).text().trim();
        // Normalize whitespace but preserve paragraph breaks
        bodyText = bodyText
          .split(/\n\n+/)
          .map(para => para.replace(/\s+/g, " ").trim())
          .filter(para => para.length > 0)
          .join("\n\n");
      }
      
      fullText += bodyText + "\n\n";
      const endIndex = fullText.length;

      if (bodyText.length > 50) {
        // Only add substantial chapters
        const chapterText = fullText.slice(startIndex, endIndex).trimEnd();
        const wordCount = chapterText.split(/\s+/).filter(w => w.length > 0).length;
        
        chapters.push({
          title: chapterTitle,
          startIndex,
          endIndex,
          wordCount,
        });

        // Extract HTML body for formatted rendering (remove scripts but keep structure)
        $("script").remove();
        
        // Convert images to base64 data URLs to preserve them
        $("img").each((_, el) => {
          const src = $(el).attr("src");
          if (src && !src.startsWith("data:") && !src.startsWith("http")) {
            const imagePath = path.join(path.dirname(contentPath), src).replace(/\\/g, "/");
            const imageEntry = zipEntries.find((e: AdmZip.IZipEntry) => e.entryName === imagePath);
            if (imageEntry) {
              const imageData = imageEntry.getData();
              const ext = path.extname(imagePath).toLowerCase();
              const mimeTypes: Record<string, string> = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".webp": "image/webp",
              };
              const mimeType = mimeTypes[ext] || "image/jpeg";
              const base64 = imageData.toString("base64");
              $(el).attr("src", `data:${mimeType};base64,${base64}`);
            }
          }
        });
        
        const bodyHtml = $("body").html() || "";
        
        htmlChapters.push({
          title: chapterTitle,
          html: bodyHtml,
          css: css || undefined,
        });
      }
    }
  }

  const trimmedText = fullText.trim();
  const totalWordCount = trimmedText.trimEnd().split(/\s+/).filter(w => w.length > 0).length;
  
  return {
    title,
    author,
    textContent: trimmedText,
    chapters: chapters.length > 0 ? chapters : [{ title: "Full Content", startIndex: 0, endIndex: trimmedText.length, wordCount: totalWordCount }],
    htmlChapters: htmlChapters.length > 0 ? htmlChapters : [],
  };
}

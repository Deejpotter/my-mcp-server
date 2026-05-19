/**
 * mailTools.ts — Local mail reading via Thunderbird mbox files
 *
 * Reads and searches the local Thunderbird mbox file to find emails
 * by sender, subject, date, or content. No network calls required.
 *
 * Env vars (optional overrides):
 *   MAIL_MBOX_PATH — path to Thunderbird INBOX mbox file
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, openSync, readSync, closeSync, fstatSync } from "fs";
import { simpleParser } from "mailparser";

// Path resolution
const DEFAULT_MBOX_PATH = "C:\\Users\\Deej\\AppData\\Roaming\\Thunderbird\\Profiles\\pqbyqff6.default-release\\ImapMail\\imap.gmail.com\\INBOX";
const MBOX_PATH = process.env.MAIL_MBOX_PATH || DEFAULT_MBOX_PATH;

// Tail-read constants
const RECENT_TAIL_BYTES = 25 * 1024 * 1024;   // 25 MB — enough for recent emails
const SEARCH_TAIL_BYTES = 100 * 1024 * 1024;   // 100 MB — for search queries
const MAX_READ_BYTES = 200 * 1024 * 1024;      // Cap at 200 MB to avoid huge reads

interface ParsedMail {
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  messageId: string | null;
  text: string | null;
}

interface CacheEntry {
  mtimeMs: number;
  size: number;
  messages: ParsedMail[];
  fetchedAt: number;
}

let recentCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute TTL

function noMbox() {
  return { content: [{ type: "text" as const, text: `Mailbox not found at ${MBOX_PATH}. Set MAIL_MBOX_PATH env var.` }] };
}

/**
 * Read the last `maxBytes` of the mbox file and parse messages from the tail.
 * Returns messages in reverse order (newest first).
 * Uses a size + mtime cache to avoid re-reading unchanged files within the TTL.
 */
async function readMboxTail(maxBytes: number, maxMessages: number = 200): Promise<ParsedMail[]> {
  if (!existsSync(MBOX_PATH)) {
    return [];
  }

  let fd: number;
  try {
    fd = openSync(MBOX_PATH, "r");
  } catch {
    return [];
  }

  try {
    const stat = fstatSync(fd);
    const fileSize = stat.size;
    const mtimeMs = stat.mtimeMs;

    // Check cache
    if (recentCache && recentCache.mtimeMs === mtimeMs && recentCache.size === fileSize && (Date.now() - recentCache.fetchedAt) < CACHE_TTL_MS) {
      closeSync(fd);
      return recentCache.messages.slice(0, maxMessages);
    }

      const readStart = Math.max(0, fileSize - Math.min(maxBytes, MAX_READ_BYTES));
      const bytesToRead = fileSize - readStart;
      const buf = Buffer.alloc(bytesToRead);

      const readBytes = readSync(fd, buf, 0, bytesToRead, readStart);
      closeSync(fd);

      const chunk = buf.toString("utf-8", 0, readBytes);

      // Find message boundaries — each message starts with "From " at beginning of line
      // Split on the mbox delimiter pattern
      const delimiter = /\nFrom [^\n]*\n/g;
      const parts = chunk.split(delimiter);

      // Reconstruct messages: each part after the first is a message body
      const rawMessages: string[] = [];
      for (let i = 1; i < parts.length; i++) {
        rawMessages.push(parts[i] as string);
      }

      // Parse messages — need to exit the sync Promise executor for await
      const parseMessages = async () => {
        const results: ParsedMail[] = [];
        for (let i = rawMessages.length - 1; i >= 0 && results.length < maxMessages; i--) {
          const raw: string | undefined = rawMessages[i];
          if (!raw) continue;
          try {
            const parsed = await simpleParser(raw as string);
            results.push({
              subject: parsed.subject || "(no subject)",
              from: parsed.from?.text || "unknown",
              to: parsed.to?.text || "",
              date: parsed.date?.toISOString() || "unknown",
              snippet: (parsed.text || parsed.html || "").toString().substring(0, 200).replace(/\s+/g, " ").trim(),
              messageId: parsed.messageId || null,
              text: parsed.text ? parsed.text.toString().substring(0, 5000) : null,
            });
          } catch {
            // Skip unparseable
          }
        }
        return results;
      };

      const finalMessages = await parseMessages();

      // Update cache
      recentCache = { mtimeMs, size: fileSize, messages: finalMessages, fetchedAt: Date.now() };
      return finalMessages;
    } catch (err) {
      try { closeSync(fd); } catch {}
      throw err;
    }
}

export function _readMboxFull(_limit: number = 50): Promise<ParsedMail[]> {
  return Promise.resolve([]);
}

export function registerMailTools(server: McpServer): void {
  // --- Search mail ---
  server.registerTool(
    "mail_search",
    {
      title: "Search Local Mail",
      description: "Search the local Thunderbird mbox file for emails matching a query. Searches sender, subject, and body text. Perfect for finding confirmation emails, API keys, and receipts.",
      inputSchema: {
        query: z.string().describe("Search term (e.g. 'serper', 'api key', 'order confirmation')."),
        max_results: z.number().optional().default(20).describe("Max emails to return (default 20)."),
        sender: z.string().optional().describe("Filter by sender email or name."),
        days: z.number().optional().describe("Only return emails from the last N days."),
      },
    },
    async ({ query, max_results = 20, sender, days }) => {
      if (!existsSync(MBOX_PATH)) return noMbox();

      const allMail = await readMboxTail(SEARCH_TAIL_BYTES, 200); // Read tail of mbox, newest first
      const lowerQuery = query.toLowerCase();
      const cutoff = days ? Date.now() - days * 86400000 : 0;

      const filtered = allMail.filter((m) => {
        if (cutoff && new Date(m.date).getTime() < cutoff) return false;
        if (sender && !m.from.toLowerCase().includes(sender.toLowerCase())) return false;
        return (
          m.subject.toLowerCase().includes(lowerQuery) ||
          m.from.toLowerCase().includes(lowerQuery) ||
          m.snippet.toLowerCase().includes(lowerQuery) ||
          (m.text && m.text.toLowerCase().includes(lowerQuery))
        );
      });

      const results = filtered.slice(0, max_results).map((m) => ({
        subject: m.subject,
        from: m.from,
        date: m.date,
        snippet: m.snippet,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: results.length
              ? `Found ${results.length} email(s) matching "${query}":\n${JSON.stringify(results, null, 2)}`
              : `No emails found matching "${query}"`,
          },
        ],
      };
    },
  );

  // --- List recent mail ---
  server.registerTool(
    "mail_recent",
    {
      title: "Recent Local Mail",
      description: "List the most recent emails from the local Thunderbird mbox file. Returns subjects, senders, and date.",
      inputSchema: {
        count: z.number().optional().default(10).describe("Number of recent emails to return (default 10, max 50)."),
        folder: z.string().optional().describe("Mail folder name (e.g. INBOX, Receipts, Personal). Defaults to INBOX."),
      },
    },
    async ({ count = 10 }) => {
      if (!existsSync(MBOX_PATH)) return noMbox();

      const allMail = await readMboxTail(RECENT_TAIL_BYTES, Math.min(count, 50));
      // Already newest-first from readMboxTail
      const results = allMail.slice(0, count).map((m) => ({
        subject: m.subject,
        from: m.from,
        date: m.date,
        snippet: m.snippet,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: results.length
              ? `Most recent ${results.length} email(s):\n${JSON.stringify(results, null, 2)}`
              : "No emails found in mailbox.",
          },
        ],
      };
    },
  );
}

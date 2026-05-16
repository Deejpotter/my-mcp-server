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
import { createReadStream, existsSync } from "fs";
import { Mbox } from "node-mbox";
import { simpleParser } from "mailparser";

// Path resolution
const DEFAULT_MBOX_PATH = "C:\\Users\\Deej\\AppData\\Roaming\\Thunderbird\\Profiles\\pqbyqff6.default-release\\ImapMail\\imap.gmail.com\\INBOX";
const MBOX_PATH = process.env.MAIL_MBOX_PATH || DEFAULT_MBOX_PATH;

interface ParsedMail {
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  messageId: string | null;
  text: string | null;
}

function noMbox() {
  return { content: [{ type: "text" as const, text: `Mailbox not found at ${MBOX_PATH}. Set MAIL_MBOX_PATH env var.` }] };
}

function readMbox(limit: number = 50): Promise<ParsedMail[]> {
  return new Promise((resolve, reject) => {
    if (!existsSync(MBOX_PATH)) {
      return resolve([]);
    }

    const results: ParsedMail[] = [];
    const stream = createReadStream(MBOX_PATH);
    const mbox = new Mbox(stream);

    mbox.on("message", async (msgBuffer: Buffer) => {
      if (results.length >= limit) return;
      try {
        const parsed = await simpleParser(msgBuffer);
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
        // Skip unparseable messages
      }
    });

    mbox.on("error", (err: Error) => reject(err));
    mbox.on("end", () => resolve(results));
  });
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

      const allMail = await readMbox(200); // Read up to 200 to have enough to filter
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

      const allMail = await readMbox(Math.min(count, 50));
      allMail.reverse(); // newest first

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

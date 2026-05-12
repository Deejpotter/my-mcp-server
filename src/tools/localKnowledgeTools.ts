import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { pathToFileURL } from "url";
import path from "path";

const DEFAULT_ROOT = process.env.LOCAL_KNOWLEDGE_ROOT || "C:\\Users\\Deej\\krasus\\projects\\local-knowledge-system";

let modulePromise: Promise<Record<string, any>> | null = null;

async function loadLocalKnowledgeModules() {
  if (!modulePromise) {
    modulePromise = (async () => {
      const [db, seed, indexer, search] = await Promise.all([
        import(pathToFileURL(path.join(DEFAULT_ROOT, "src", "db.js")).href),
        import(pathToFileURL(path.join(DEFAULT_ROOT, "src", "seed.js")).href),
        import(pathToFileURL(path.join(DEFAULT_ROOT, "src", "indexer.js")).href),
        import(pathToFileURL(path.join(DEFAULT_ROOT, "src", "search.js")).href),
      ]);

      return {
        ...db,
        ...seed,
        ...indexer,
        ...search,
      };
    })();
  }

  return modulePromise;
}

function openLocalDb(mods: Record<string, any>) {
  return mods.openDatabases();
}

async function runLocalKnowledge<T>(handler: (mods: Record<string, any>) => Promise<T> | T): Promise<T> {
  const mods = await loadLocalKnowledgeModules();
  return handler(mods);
}

function summarizeLookup(result: any) {
  const product = result.product || result;
  return {
    type: result.type,
    score: result.score,
    sku: product?.sku,
    name: product?.name,
    alias: result.alias ?? null,
    url: result.url ?? null,
    bom: result.bom
      ? {
          kit_sku: result.bom.kit_sku,
          kit_name: result.bom.kit_name,
          version_tag: result.bom.version_tag,
          items: result.items ?? [],
        }
      : null,
    urls: result.urls ?? [],
    specs: result.specs ?? [],
    compatibility: result.compatibility ?? [],
    document: result.document ?? null,
    documents: result.documents ?? null,
  };
}

function summarizeSearchResult(result: any) {
  return {
    type: result.type || result.chunk_kind || "unknown",
    score: result.score ?? 0,
    source_db: result.source_db ?? null,
    source_table: result.source_table ?? null,
    source_key: result.source_key ?? null,
    source_label: result.source_label ?? null,
    title: result.title ?? null,
    text: result.text ?? null,
  };
}

export function registerLocalKnowledgeTools(server: McpServer) {
  server.registerTool(
    "local_knowledge_status",
    {
      title: "Local Knowledge Status",
      description:
        "Inspect the local multi-database knowledge system, including database counts and file sizes.",
      inputSchema: {},
    },
    async () => {
      try {
        return await runLocalKnowledge(async (mods) => {
          const dbs = openLocalDb(mods);
          try {
            const summary = mods.printDatabaseStatus(dbs);
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Local knowledge system status loaded from ${DEFAULT_ROOT}`,
                },
              ],
              structuredContent: {
                root: DEFAULT_ROOT,
                databases: summary,
              },
            };
          } finally {
            mods.closeDatabases(dbs);
          }
        });
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `❌ Local knowledge status failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "local_knowledge_lookup",
    {
      title: "Local Knowledge Exact Lookup",
      description:
        "Perform exact lookup against the local knowledge databases using SKU, alias, URL, or exact query text.",
      inputSchema: {
        query: z.string().optional().describe("Free-text query to match exactly or by alias"),
        sku: z.string().optional().describe("Exact SKU"),
        alias: z.string().optional().describe("Exact alias"),
        url: z.string().optional().describe("Exact URL"),
      },
    },
    async ({ query, sku, alias, url }) => {
      try {
        return await runLocalKnowledge(async (mods) => {
          const dbs = openLocalDb(mods);
          try {
            const results = mods.lookupExact(dbs, { query, sku, alias, url });
            return {
              content: [
                {
                  type: "text",
                  text: results.length
                    ? `✅ Found ${results.length} exact match(es) in the local knowledge system`
                    : "ℹ️ No exact matches found",
                },
              ],
              structuredContent: {
                query: query || null,
                sku: sku || null,
                alias: alias || null,
                url: url || null,
                count: results.length,
                results: results.map(summarizeLookup),
              },
            };
          } finally {
            mods.closeDatabases(dbs);
          }
        });
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `❌ Local knowledge lookup failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "local_knowledge_search",
    {
      title: "Local Knowledge Hybrid Search",
      description:
        "Search across the local knowledge system using exact lookup, FTS, and semantic retrieval.",
      inputSchema: {
        query: z.string().describe("Search query"),
        limit: z.number().optional().default(10).describe("Maximum number of results to return"),
      },
    },
    async ({ query, limit = 10 }) => {
      try {
        return await runLocalKnowledge(async (mods) => {
          const dbs = openLocalDb(mods);
          try {
            const result = await mods.searchKnowledge(dbs, query, { limit });
            return {
              content: [
                {
                  type: "text",
                  text: `✅ Hybrid search returned ${result.results.length} result(s)`,
                },
              ],
              structuredContent: {
                query: result.query,
                exactCount: result.exact.length,
                ftsCount: result.fts.length,
                semanticCount: result.semantic.length,
                results: result.results.map(summarizeSearchResult),
              },
            };
          } finally {
            mods.closeDatabases(dbs);
          }
        });
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `❌ Local knowledge search failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "local_knowledge_rebuild",
    {
      title: "Local Knowledge Rebuild",
      description:
        "Rebuild the unified retrieval index and embeddings for the local knowledge system.",
      inputSchema: {},
    },
    async () => {
      try {
        return await runLocalKnowledge(async (mods) => {
          const dbs = openLocalDb(mods);
          try {
            mods.rebuildRetrievalIndex(dbs);
            const embedded = await mods.embedRetrievalIndex(dbs);
            return {
              content: [{ type: "text", text: `✅ Retrieval index rebuilt (${embedded.updated} embeddings updated)` }],
              structuredContent: {
                root: DEFAULT_ROOT,
                embeddingsUpdated: embedded.updated,
              },
            };
          } finally {
            mods.closeDatabases(dbs);
          }
        });
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `❌ Local knowledge rebuild failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "local_knowledge_seed",
    {
      title: "Local Knowledge Seed",
      description:
        "Seed the local knowledge system with sample product, BOM, support, and document data.",
      inputSchema: {},
    },
    async () => {
      try {
        return await runLocalKnowledge(async (mods) => {
          const dbs = openLocalDb(mods);
          try {
            const stats = mods.seedSampleData(dbs);
            mods.rebuildRetrievalIndex(dbs);
            const embedded = await mods.embedRetrievalIndex(dbs);
            return {
              content: [{ type: "text", text: `✅ Local knowledge system seeded and indexed` }],
              structuredContent: {
                root: DEFAULT_ROOT,
                seeded: stats,
                embeddingsUpdated: embedded.updated,
              },
            };
          } finally {
            mods.closeDatabases(dbs);
          }
        });
      } catch (error: unknown) {
        const err = error as Error;
        return {
          content: [{ type: "text", text: `❌ Local knowledge seed failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

# QA Store Design (Embeddings-backed)

Purpose: Support semantic search (RAG) over canonical Q/A pairs for technical assistance.

## Collections

- `qa_pairs`
  - Fields: `q` (string), `a` (string), `tags` (string[]), `sources` (string[]), `createdAt` (ISO string)
- `qa_embeddings`
  - Fields: `pairId` (ObjectId), `vector` (embedding array), `dim` (number)
  - Index: Vector index on `vector`

## Insert flow (generate mode)

1. Extract `{q,a}` pairs from raw convo.
2. Validate shape and length; strip PII.
3. On approval, insert into `qa_pairs` and compute/store embedding in `qa_embeddings`.

## Search flow

1. Embed query.
2. ANN search on `qa_embeddings` top-k.
3. Join with `qa_pairs`, return `{q,a,score,sources}`.

## Notes

- Keep answers concise; cite sources.
- Prefer tags for controller (e.g., grblHAL, E5X) and symptom (Alarm:8).
- Moderation: require user approval for new entries.

/**
 * Build the public URL identifier from a Convex-generated document ID.
 *
 * Convex document IDs are server-generated, opaque, high-entropy base32
 * strings and are URL-safe. Prefixing the ID gives decision links a stable,
 * recognizable namespace without deriving anything from private decision
 * content or accepting a caller-selected public identifier.
 */
export function decisionPublicSlug(decisionId: string): string {
  return `d_${decisionId}`;
}

/** Keep private scheduling topics out of URLs, previews, logs, and history. */
export function availabilityPublicSlug(pollId: string): string {
  return `s_${pollId}`;
}

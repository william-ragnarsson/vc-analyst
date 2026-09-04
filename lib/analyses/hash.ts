/**
 * The deck fingerprint: a hex SHA-256 of the PDF bytes.
 *
 * It is both the dedupe key (re-uploading the same deck reopens its report
 * instead of burning another run) and the `/due-diligence/[id]` URL segment.
 * Computed identically on the client (before upload) and on the server (before
 * persisting), so both agree on the id without passing it around. WebCrypto is
 * global in Node 20+, so one implementation covers both.
 */
export async function hashBytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashFile(file: File): Promise<string> {
  return hashBytes(await file.arrayBuffer());
}

import crypto from "crypto";

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function hmacSha256Hex(secret: string, data: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function sha1Hex(data: string): string {
  return crypto.createHash("sha1").update(data).digest("hex");
}

export function randomBytes(n: number): Uint8Array {
  return crypto.randomBytes(n);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

export function bufferToHex(buf: Buffer | Uint8Array): string {
  return hexEncode(
    buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  );
}

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hexDecode(hex));
}

export { hexEncode, hexDecode };

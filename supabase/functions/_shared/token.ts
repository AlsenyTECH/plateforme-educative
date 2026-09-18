// Encodage/decodage du payload signe des cartes scolaires (pole 06 du cahier
// des charges). Format binaire compact, pense pour tenir dans un petit QR :
//   card_id (16 octets) + student_id (16) + school_id (16)
//   + issued_at (4, secondes unix, big-endian) + card_version (1) = 53 octets
//
// Le payload n'est PAS chiffre : rien dedans n'est confidentiel (un card_id
// n'est pas un secret, comme un numero de badge). Seule l'authenticite compte,
// donc on signe (Ed25519), on ne chiffre pas.

const PAYLOAD_LENGTH = 53;

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error(`UUID invalide: ${uuid}`);
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface CardPayload {
  cardId: string;
  studentId: string;
  schoolId: string;
  issuedAt: Date;
  cardVersion: number;
}

export function encodePayload(p: CardPayload): Uint8Array {
  if (p.cardVersion < 0 || p.cardVersion > 255) {
    throw new Error("card_version doit tenir sur 1 octet (0-255)");
  }
  const bytes = new Uint8Array(PAYLOAD_LENGTH);
  bytes.set(uuidToBytes(p.cardId), 0);
  bytes.set(uuidToBytes(p.studentId), 16);
  bytes.set(uuidToBytes(p.schoolId), 32);
  const view = new DataView(bytes.buffer);
  view.setUint32(48, Math.floor(p.issuedAt.getTime() / 1000), false);
  bytes[52] = p.cardVersion;
  return bytes;
}

export function decodePayload(bytes: Uint8Array): CardPayload {
  if (bytes.length !== PAYLOAD_LENGTH) {
    throw new Error(`Payload de taille invalide: ${bytes.length} octets (attendu ${PAYLOAD_LENGTH})`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    cardId: bytesToUuid(bytes.slice(0, 16)),
    studentId: bytesToUuid(bytes.slice(16, 32)),
    schoolId: bytesToUuid(bytes.slice(32, 48)),
    issuedAt: new Date(view.getUint32(48, false) * 1000),
    cardVersion: bytes[52],
  };
}

export function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(base64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeToken(payloadBytes: Uint8Array, signature: Uint8Array): string {
  return `${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`;
}

export function decodeToken(token: string): { payload: Uint8Array; signature: Uint8Array } {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) throw new Error("Format de token invalide");
  return { payload: fromBase64Url(payloadPart), signature: fromBase64Url(signaturePart) };
}

// ---------------------------------------------------------------------------
// Conversion vers/depuis le format hexadecimal que PostgREST attend pour les
// colonnes bytea (prefixe "\x" suivi de paires hexadecimales).
// ---------------------------------------------------------------------------

export function toPgBytea(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "\\x" + hex;
}

export function fromPgBytea(value: string): Uint8Array {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, hexToBytes } from '../crypto/bytes';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`invalid base58 char: ${ch}`);
    num = num * 58n + BigInt(idx);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = num === 0n ? new Uint8Array([]) : hexToBytes('0x' + hex);
  let leading = 0;
  for (const ch of str) { if (ch === '1') leading++; else break; }
  if (leading) bytes = concatBytes(new Uint8Array(leading), bytes);
  return bytes;
}

function b58encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) { out = ALPHABET[Number(num % 58n)] + out; num /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

function sha256d(bytes: Uint8Array): Uint8Array { return sha256(sha256(bytes)); }

// 'TUEZ...' -> '41' + 40-hex (42 hex chars total)
export function tronAddressToHex(base58: string): string {
  const data = b58decode(base58);              // 25 bytes: 21 payload + 4 checksum
  if (data.length !== 25) throw new Error('bad TRON address length');
  const payload = data.slice(0, 21);
  const checksum = data.slice(21);
  const expected = sha256d(payload).slice(0, 4);
  for (let i = 0; i < 4; i++) if (checksum[i] !== expected[i]) throw new Error('bad TRON address checksum');
  return bytesToHex(payload).slice(2);         // strip '0x'
}

export function hexToTronAddress(hex: string): string {
  const payload = hexToBytes(hex.startsWith('0x') ? hex : '0x' + hex);
  if (payload.length !== 21 || payload[0] !== 0x41) throw new Error('bad TRON hex address');
  const checksum = sha256d(payload).slice(0, 4);
  return b58encode(concatBytes(payload, checksum));
}

import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes } from '../crypto/bytes';

// TRON txID is the bare (no 0x) lowercase hex of sha256(raw_data bytes).
export function tronTxId(rawDataHex: string): string {
  const clean = rawDataHex.startsWith('0x') ? rawDataHex.slice(2) : rawDataHex;
  const digest = sha256(hexToBytes('0x' + clean));
  let s = '';
  for (const b of digest) s += b.toString(16).padStart(2, '0');
  return s;
}

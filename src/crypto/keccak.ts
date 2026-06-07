import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, hexToBytes } from './bytes';

// keccak-256 of public transaction/message data. Never used on private keys.
export function keccak256(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? hexToBytes(input) : input;
  return bytesToHex(keccak_256(bytes));
}

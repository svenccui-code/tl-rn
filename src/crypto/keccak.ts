import { keccak256 as viemKeccak256, type Hex } from 'viem';

// keccak-256 of public transaction/message data. Never used on private keys.
export function keccak256(input: Uint8Array | string): string {
  return viemKeccak256(typeof input === 'string' ? (input as Hex) : input);
}

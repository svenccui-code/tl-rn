import { TronWeb } from 'tronweb';

// Converts a TRON base58check address to lowercase '41'-prefixed hex (42 chars).
// TronWeb.address.toHex validates the checksum and throws on a bad address.
export function tronAddressToHex(base58: string): string {
  const hex = TronWeb.address.toHex(base58); // throws on bad checksum or format
  if (!/^41[0-9a-f]{40}$/i.test(hex)) throw new Error(`bad TRON address: ${base58}`);
  return hex.toLowerCase();
}

// Converts a '41'-prefixed hex address (with or without '0x') back to base58check.
export function hexToTronAddress(hex: string): string {
  return TronWeb.address.fromHex(hex.startsWith('0x') ? hex.slice(2) : hex);
}

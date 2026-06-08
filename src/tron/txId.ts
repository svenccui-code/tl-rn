import { utils } from 'tronweb';

// TRON txID = sha256(raw_data bytes), bare lowercase hex (no 0x prefix).
export function tronTxId(rawDataHex: string): string {
  const clean = rawDataHex.startsWith('0x') ? rawDataHex : '0x' + rawDataHex;
  const h = utils.ethersUtils.sha256(clean); // returns '0x' + 64-char hex
  return (h.startsWith('0x') ? h.slice(2) : h).toLowerCase();
}

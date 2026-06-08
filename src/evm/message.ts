import { hashMessage } from 'viem';

export function personalSignHash(message: string): string {
  return hashMessage(message);
}

// signHash returns r||s||yParity(0/1); Ethereum personal_sign expects v = 27/28.
export function toEthSignatureV(signatureHex: string): string {
  const h = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  if (h.length !== 130) throw new Error('expected 65-byte signature');
  const v = (27 + parseInt(h.slice(128, 130), 16)).toString(16).padStart(2, '0');
  return '0x' + h.slice(0, 128) + v;
}

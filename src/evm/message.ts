import { concatBytes, hexToBytes, bytesToHex, stringToUtf8Bytes } from '../crypto/bytes';
import { keccak256 } from '../crypto/keccak';

export function personalSignHash(message: string): string {
  const msg = stringToUtf8Bytes(message);
  const prefix = stringToUtf8Bytes(
    `\x19Ethereum Signed Message:\n${msg.length}`
  );
  return keccak256(concatBytes(prefix, msg));
}

// signHash returns r||s||yParity(0/1); Ethereum personal_sign expects v = 27/28.
export function toEthSignatureV(signatureHex: string): string {
  const sig = hexToBytes(signatureHex);
  if (sig.length !== 65) throw new Error('expected 65-byte signature');
  const v = 27 + sig[64];
  return bytesToHex(concatBytes(sig.slice(0, 64), new Uint8Array([v])));
}

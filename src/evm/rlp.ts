import { concatBytes } from '../crypto/bytes';

export type RlpInput = Uint8Array | RlpInput[];

function encodeLength(len: number, offset: number): Uint8Array {
  if (len < 56) return new Uint8Array([offset + len]);
  const hex = len.toString(16);
  const lenBytes = new Uint8Array(hex.length % 2 ? (hex.length + 1) / 2 : hex.length / 2);
  let n = len;
  for (let i = lenBytes.length - 1; i >= 0; i--) { lenBytes[i] = n & 0xff; n >>= 8; }
  return concatBytes(new Uint8Array([offset + 55 + lenBytes.length]), lenBytes);
}

export function rlpEncode(input: RlpInput): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length === 1 && input[0] < 0x80) return input;
    return concatBytes(encodeLength(input.length, 0x80), input);
  }
  const items = input.map(rlpEncode);
  const payload = concatBytes(...items);
  return concatBytes(encodeLength(payload.length, 0xc0), payload);
}

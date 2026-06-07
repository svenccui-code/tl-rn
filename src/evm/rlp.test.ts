import { rlpEncode } from './rlp';
import { hexToBytes, bytesToHex } from '../crypto/bytes';

const b = (h: string) => hexToBytes(h);

describe('rlpEncode', () => {
  it('encodes empty string as 0x80', () => {
    expect(bytesToHex(rlpEncode(b('0x')))).toBe('0x80');
  });
  it('encodes a single byte < 0x80 as itself', () => {
    expect(bytesToHex(rlpEncode(b('0x01')))).toBe('0x01');
  });
  it('encodes "dog" (0x646f67) with 0x83 prefix', () => {
    expect(bytesToHex(rlpEncode(b('0x646f67')))).toBe('0x83646f67');
  });
  it('encodes the list ["cat","dog"]', () => {
    expect(bytesToHex(rlpEncode([b('0x636174'), b('0x646f67')]))).toBe('0xc88363617483646f67');
  });
  it('encodes the empty list as 0xc0', () => {
    expect(bytesToHex(rlpEncode([]))).toBe('0xc0');
  });
});

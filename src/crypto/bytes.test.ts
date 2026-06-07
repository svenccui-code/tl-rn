import { hexToBytes, bytesToHex, bigIntToMinimalBytes, concatBytes } from './bytes';

describe('bytes', () => {
  it('hex <-> bytes round-trips', () => {
    expect(bytesToHex(hexToBytes('0x0a0b'))).toBe('0x0a0b');
    expect(Array.from(hexToBytes('0xff00'))).toEqual([255, 0]);
  });
  it('bigint to minimal big-endian (no leading zeros; 0 -> empty)', () => {
    expect(Array.from(bigIntToMinimalBytes(0n))).toEqual([]);
    expect(Array.from(bigIntToMinimalBytes(1n))).toEqual([1]);
    expect(Array.from(bigIntToMinimalBytes(256n))).toEqual([1, 0]);
    expect(bytesToHex(bigIntToMinimalBytes(1000000000000000n))).toBe('0x038d7ea4c68000');
  });
  it('concatBytes joins', () => {
    expect(Array.from(concatBytes(new Uint8Array([1]), new Uint8Array([2, 3])))).toEqual([1, 2, 3]);
  });
});

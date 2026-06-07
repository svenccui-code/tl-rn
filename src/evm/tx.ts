import { bigIntToMinimalBytes, bytesToHex, concatBytes, hexToBytes } from '../crypto/bytes';
import { keccak256 } from '../crypto/keccak';
import { rlpEncode, RlpInput } from './rlp';

export interface UnsignedEvmTx {
  chainId: bigint; nonce: bigint;
  maxPriorityFeePerGas: bigint; maxFeePerGas: bigint; gasLimit: bigint;
  to: string; value: bigint; data: string;
}

const TYPE_2 = new Uint8Array([0x02]);

function eip1559Fields(tx: UnsignedEvmTx): RlpInput[] {
  return [
    bigIntToMinimalBytes(tx.chainId),
    bigIntToMinimalBytes(tx.nonce),
    bigIntToMinimalBytes(tx.maxPriorityFeePerGas),
    bigIntToMinimalBytes(tx.maxFeePerGas),
    bigIntToMinimalBytes(tx.gasLimit),
    hexToBytes(tx.to),
    bigIntToMinimalBytes(tx.value),
    hexToBytes(tx.data),
    [], // accessList
  ];
}

export function encodeUnsignedEip1559(tx: UnsignedEvmTx): Uint8Array {
  return concatBytes(TYPE_2, rlpEncode(eip1559Fields(tx)));
}

export function eip1559SigningHash(tx: UnsignedEvmTx): string {
  return keccak256(encodeUnsignedEip1559(tx));
}

// signatureHex = 0x + r(32) + s(32) + yParity(1). Returns the 0x-prefixed signed type-2 rawTx.
export function assembleSignedEip1559(tx: UnsignedEvmTx, signatureHex: string): string {
  const sig = hexToBytes(signatureHex);
  if (sig.length !== 65) throw new Error(`signature must be 65 bytes, got ${sig.length}`);
  const r = sig.slice(0, 32);
  const s = sig.slice(32, 64);
  const yParity = BigInt(sig[64]);
  // EIP-1559 RLP encodes r and s as minimal big-endian integers (leading zeros stripped).
  const stripLeadingZeros = (bytes: Uint8Array) => {
    let i = 0; while (i < bytes.length - 1 && bytes[i] === 0) i++; return bytes.slice(i);
  };
  const fields: RlpInput[] = [
    ...eip1559Fields(tx),
    bigIntToMinimalBytes(yParity),
    stripLeadingZeros(r),
    stripLeadingZeros(s),
  ];
  return bytesToHex(concatBytes(TYPE_2, rlpEncode(fields)));
}

export function evmTxHash(signedRawTxHex: string): string {
  return keccak256(signedRawTxHex);
}

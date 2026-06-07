import { bigIntToMinimalBytes, concatBytes, hexToBytes } from '../crypto/bytes';
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

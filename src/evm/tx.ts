import { serializeTransaction, keccak256, type TransactionSerializableEIP1559, type Hex } from 'viem';

export interface UnsignedEvmTx {
  chainId: bigint; nonce: bigint;
  maxPriorityFeePerGas: bigint; maxFeePerGas: bigint; gasLimit: bigint;
  to: string; value: bigint; data: string;
}

function toViem(tx: UnsignedEvmTx): TransactionSerializableEIP1559 {
  return {
    type: 'eip1559',
    chainId: Number(tx.chainId),
    nonce: Number(tx.nonce),
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    maxFeePerGas: tx.maxFeePerGas,
    gas: tx.gasLimit,
    to: tx.to as Hex,
    value: tx.value,
    data: (tx.data || '0x') as Hex,
  };
}

export function eip1559SigningHash(tx: UnsignedEvmTx): string {
  return keccak256(serializeTransaction(toViem(tx)));
}

// signatureHex = 0x + r(32) + s(32) + yParity(1) — the shape SecureKeyring.signHash returns.
export function assembleSignedEip1559(tx: UnsignedEvmTx, signatureHex: string): string {
  const h = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  if (h.length !== 130) throw new Error(`signature must be 65 bytes, got ${h.length / 2}`);
  const r = ('0x' + h.slice(0, 64)) as Hex;
  const s = ('0x' + h.slice(64, 128)) as Hex;
  const yParity = parseInt(h.slice(128, 130), 16) as 0 | 1;
  return serializeTransaction(toViem(tx), { r, s, yParity });
}

export function evmTxHash(signedRawTxHex: string): string {
  return keccak256(signedRawTxHex as Hex);
}

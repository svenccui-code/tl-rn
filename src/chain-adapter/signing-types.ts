import type { ReadOnlyChainAdapter } from './types';
import type { UnsignedEvmTx } from '../evm/tx';

export interface TxRequest { from: string; to: string; value: bigint; data?: string; gasLimit?: bigint; }

export interface SigningChainAdapter extends ReadOnlyChainAdapter {
  buildTransaction(req: TxRequest): Promise<UnsignedEvmTx>;
  sign(tx: UnsignedEvmTx, walletRef: string): Promise<string>; // -> signed rawTx hex
  broadcast(signedRawTx: string): Promise<string>;             // -> tx hash
  personalSign(message: string, walletRef: string): Promise<string>;
}

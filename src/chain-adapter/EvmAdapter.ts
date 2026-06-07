import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { ChainConfig } from '../chain-registry/types';
import { jsonRpc } from '../net/jsonRpc';
import { decodeUint256, erc20BalanceOfData } from './abi';
import type { ReadOnlyChainAdapter, TokenRef } from './types';

export class EvmAdapter implements ReadOnlyChainAdapter {
  constructor(public readonly config: ChainConfig) {}

  deriveAddress(walletRef: string): Promise<string> {
    return SecureKeyring.deriveAddress(walletRef, this.config.coinType);
  }

  validateAddress(address: string): boolean {
    return SecureKeyring.validateAddress(address, this.config.coinType);
  }

  async getNativeBalance(address: string): Promise<bigint> {
    const hex = await jsonRpc(this.config.rpc, 'eth_getBalance', [address, 'latest']);
    return decodeUint256(hex);
  }

  async getTokenBalance(address: string, token: TokenRef): Promise<bigint> {
    const hex = await jsonRpc(this.config.rpc, 'eth_call', [
      { to: token.address, data: erc20BalanceOfData(address) },
      'latest',
    ]);
    return decodeUint256(hex);
  }
}

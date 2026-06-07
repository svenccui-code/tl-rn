import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { ChainConfig } from '../chain-registry/types';
import { httpJson, withFailover } from '../net/http';
import type { ReadOnlyChainAdapter, TokenRef } from './types';

export class TronAdapter implements ReadOnlyChainAdapter {
  constructor(public readonly config: ChainConfig) {}

  deriveAddress(walletRef: string): Promise<string> {
    return SecureKeyring.deriveAddress(walletRef, this.config.coinType);
  }

  validateAddress(address: string): boolean {
    return SecureKeyring.validateAddress(address, this.config.coinType);
  }

  async getNativeBalance(address: string): Promise<bigint> {
    const acct = await withFailover(this.config.rpc, base =>
      httpJson(`${base}/wallet/getaccount`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, visible: true }),
      }),
    );
    return BigInt(acct?.balance ?? 0);
  }

  async getTokenBalance(address: string, token: TokenRef): Promise<bigint> {
    const res = await withFailover(this.config.rpc, base =>
      httpJson(`${base}/v1/accounts/${address}`),
    );
    const trc20: Array<Record<string, string>> = res?.data?.[0]?.trc20 ?? [];
    for (const entry of trc20) {
      if (token.address in entry) return BigInt(entry[token.address]);
    }
    return 0n;
  }
}

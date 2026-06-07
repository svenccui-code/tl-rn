import type { ChainConfig } from '../chain-registry/types';

export interface TokenRef {
  address: string;      // contract address (EVM 0x… / TRON base58 T…)
  decimals: number;
  symbol?: string;
}

// Phase 1 is read-only. Signing/broadcast methods are added in Phase 2 via
// `SigningChainAdapter extends ReadOnlyChainAdapter`.
export interface ReadOnlyChainAdapter {
  readonly config: ChainConfig;
  deriveAddress(walletRef: string): Promise<string>;
  validateAddress(address: string): boolean;
  getNativeBalance(address: string): Promise<bigint>; // smallest unit (wei / sun)
  getTokenBalance(address: string, token: TokenRef): Promise<bigint>; // smallest unit
}

import type { ChainConfig } from '../chain-registry/types';
import { EvmAdapter } from './EvmAdapter';
import { TronAdapter } from './TronAdapter';
import type { ReadOnlyChainAdapter } from './types';

export function getAdapter(config: ChainConfig): ReadOnlyChainAdapter {
  switch (config.family) {
    case 'evm': return new EvmAdapter(config);
    case 'tron': return new TronAdapter(config);
    default: throw new Error(`no adapter for family: ${config.family}`);
  }
}

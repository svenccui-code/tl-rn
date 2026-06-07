import type { ChainConfig, ChainFamily } from './types';

// NOTE: rpc.primary uses public endpoints for Phase 1. Replace with the
// self-operated TronLink gateway before production (architecture D6).
export const CHAINS: ChainConfig[] = [
  {
    caip2: 'tron:728126428', coinType: 195, family: 'tron', name: 'TRON',
    nativeSymbol: 'TRX', decimals: 6,
    rpc: { primary: 'https://api.trongrid.io', fallback: ['https://api.tronstack.io'] },
    explorerTx: 'https://tronscan.org/#/transaction/',
    capabilities: { dapp: true, nft: true, defi: true },
  },
  {
    caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'Ethereum',
    nativeSymbol: 'ETH', decimals: 18,
    rpc: { primary: 'https://eth.llamarpc.com', fallback: ['https://rpc.ankr.com/eth', 'https://cloudflare-eth.com'] },
    explorerTx: 'https://etherscan.io/tx/',
    capabilities: { dapp: true, nft: true, defi: true },
  },
  {
    caip2: 'eip155:56', coinType: 60, family: 'evm', name: 'BNB Smart Chain',
    nativeSymbol: 'BNB', decimals: 18,
    rpc: { primary: 'https://bsc-dataseed.binance.org', fallback: ['https://bsc-dataseed1.defibit.io'] },
    explorerTx: 'https://bscscan.com/tx/',
    capabilities: { dapp: true, nft: true, defi: false },
  },
];

export function getChain(caip2: string): ChainConfig | undefined {
  return CHAINS.find(c => c.caip2 === caip2);
}

export function chainsByFamily(family: ChainFamily): ChainConfig[] {
  return CHAINS.filter(c => c.family === family);
}

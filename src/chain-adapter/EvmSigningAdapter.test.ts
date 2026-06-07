declare const global: any;
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { EvmSigningAdapter, getSigningAdapter } from './EvmSigningAdapter';
import { EVM_GOLDEN } from '../evm/evmGolden';
import type { ChainConfig } from '../chain-registry/types';

const ETH: ChainConfig = {
  caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'Ethereum', nativeSymbol: 'ETH',
  decimals: 18, rpc: { primary: 'https://rpc', fallback: [] }, explorerTx: 'https://e/',
  capabilities: { dapp: true, nft: true, defi: true },
};

describe('EvmSigningAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('getSigningAdapter returns an EvmSigningAdapter for evm', () => {
    expect(getSigningAdapter(ETH)).toBeInstanceOf(EvmSigningAdapter);
  });

  it('builds an EIP-1559 tx, filling nonce + fees from RPC', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x0' }) })                 // eth_getTransactionCount
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x3b9aca00' }) })          // eth_maxPriorityFeePerGas = 1 gwei
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { baseFeePerGas: '0x4a817c800' } }) }); // eth_getBlockByNumber base fee ~20 gwei
    const a = new EvmSigningAdapter(ETH);
    const tx = await a.buildTransaction({ from: EVM_GOLDEN.from, to: EVM_GOLDEN.from, value: 1000000000000000n });
    expect(tx.chainId).toBe(1n);
    expect(tx.nonce).toBe(0n);
    expect(tx.gasLimit).toBe(21000n);
    expect(tx.maxFeePerGas).toBeGreaterThan(tx.maxPriorityFeePerGas);
  });

  it('signs via signHash and assembles the golden rawTx', async () => {
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue(EVM_GOLDEN.signatureHex);
    const a = new EvmSigningAdapter(ETH);
    const raw = await a.sign(EVM_GOLDEN.tx, 'wref');
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 60, EVM_GOLDEN.signingHash);
    expect(raw).toBe(EVM_GOLDEN.signedRawTx);
  });

  it('broadcasts via eth_sendRawTransaction', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: EVM_GOLDEN.txHash }) });
    const a = new EvmSigningAdapter(ETH);
    const hash = await a.broadcast(EVM_GOLDEN.signedRawTx);
    expect(hash).toBe(EVM_GOLDEN.txHash);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_sendRawTransaction');
    expect(body.params).toEqual([EVM_GOLDEN.signedRawTx]);
  });
});

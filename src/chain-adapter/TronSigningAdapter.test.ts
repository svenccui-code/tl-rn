declare const global: any;
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { TronSigningAdapter, getTronSigningAdapter } from './TronSigningAdapter';
import { TRON_GOLDEN } from '../tron/tronGolden';
import type { ChainConfig } from '../chain-registry/types';

const TRON: ChainConfig = {
  caip2: 'tron:728126428', coinType: 195, family: 'tron', name: 'TRON', nativeSymbol: 'TRX',
  decimals: 6, rpc: { primary: 'https://trongrid', fallback: [] }, explorerTx: 'https://t/',
  capabilities: { dapp: true, nft: true, defi: true },
};
const FROM = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';
const TO = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC';

// Build a tx whose txID matches sha256(raw_data_hex) — passes the integrity gate.
const trxBuilt = (value: any) => ({
  txID: TRON_GOLDEN.txId,
  raw_data_hex: TRON_GOLDEN.rawDataHex,
  visible: true,
  raw_data: { contract: [{ type: 'TransferContract', parameter: { value } }] },
});

// Mock the tronweb build module so makeTronWeb() returns a fake instance
// with a controllable transactionBuilder. This avoids real network calls.
let mockSendTrx: jest.Mock;
jest.mock('../tron/build', () => {
  const actual = jest.requireActual('../tron/build');
  return {
    ...actual,
    makeTronWeb: jest.fn(() => ({
      transactionBuilder: {
        get sendTrx() { return mockSendTrx; },
      },
    })),
  };
});

describe('TronSigningAdapter', () => {
  afterEach(() => {
    (global.fetch as jest.Mock)?.mockReset?.();
    mockSendTrx?.mockReset?.();
  });

  it('getTronSigningAdapter returns a TronSigningAdapter for tron', () => {
    expect(getTronSigningAdapter(TRON)).toBeInstanceOf(TronSigningAdapter);
  });

  it('sendTrx: build (via tronweb) -> verify(integrity) -> sign(local txID) -> broadcast', async () => {
    const value = { owner_address: FROM, to_address: TO, amount: 1000000 };
    mockSendTrx = jest.fn(async () => trxBuilt(value));
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: true, txid: TRON_GOLDEN.txId }),
    });
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue('0x' + 'cd'.repeat(65));
    const a = new TronSigningAdapter(TRON);
    const txid = await a.sendTrx('wref', FROM, TO, 1000000n);
    expect(mockSendTrx).toHaveBeenCalledWith(TO, 1000000, FROM);
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 195, '0x' + TRON_GOLDEN.txId);
    expect(txid).toBe(TRON_GOLDEN.txId);
    // broadcast fetch body should include signature
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).signature).toEqual(['cd'.repeat(65)]);
  });

  it('SECURITY: aborts (no signHash, no broadcast) if tronweb returns a mismatched txID', async () => {
    const value = { owner_address: FROM, to_address: TO, amount: 1000000 };
    mockSendTrx = jest.fn(async () => ({
      ...trxBuilt(value),
      txID: 'dead'.padEnd(64, '0'), // tampered txID — does not match sha256(raw_data_hex)
    }));
    global.fetch = jest.fn();
    const a = new TronSigningAdapter(TRON);
    await expect(a.sendTrx('wref', FROM, TO, 1000000n)).rejects.toThrow(/txID/i);
    expect(SecureKeyring.signHash).not.toHaveBeenCalled();
    // broadcast must not be called
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(0);
  });
});

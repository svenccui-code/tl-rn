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

// A node 'created' tx whose txID matches sha256(raw_data_hex) and whose contract is a TransferContract.
const trxBuilt = (value: any) => ({
  txID: TRON_GOLDEN.txId, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true,
  raw_data: { contract: [{ type: 'TransferContract', parameter: { value } }] },
});

describe('TronSigningAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('getTronSigningAdapter returns a TronSigningAdapter for tron', () => {
    expect(getTronSigningAdapter(TRON)).toBeInstanceOf(TronSigningAdapter);
  });

  it('sendTrx: build -> verify -> sign(local txID) -> broadcast', async () => {
    const value = { owner_address: FROM, to_address: TO, amount: 1000000 };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => trxBuilt(value) })                          // createtransaction
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: true, txid: TRON_GOLDEN.txId }) }); // broadcast
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue('0x' + 'cd'.repeat(65));
    const a = new TronSigningAdapter(TRON);
    const txid = await a.sendTrx('wref', FROM, TO, 1000000n);
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 195, '0x' + TRON_GOLDEN.txId);
    expect(txid).toBe(TRON_GOLDEN.txId);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).signature).toEqual(['cd'.repeat(65)]);
  });

  it('SECURITY: aborts (no signHash, no broadcast) if node returns a mismatched txID', async () => {
    const built = { txID: 'dead'.padEnd(64, '0'), raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true, raw_data: { contract: [{ type: 'TransferContract', parameter: { value: { owner_address: FROM, to_address: TO, amount: 1000000 } } }] } };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => built });
    const a = new TronSigningAdapter(TRON);
    await expect(a.sendTrx('wref', FROM, TO, 1000000n)).rejects.toThrow(/txID/i);
    expect(SecureKeyring.signHash).not.toHaveBeenCalled();
  });

  it('SECURITY: aborts if node returns the wrong contract type', async () => {
    const built = { txID: TRON_GOLDEN.txId, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true, raw_data: { contract: [{ type: 'TriggerSmartContract', parameter: { value: { owner_address: FROM } } }] } };
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => built });
    const a = new TronSigningAdapter(TRON);
    await expect(a.sendTrx('wref', FROM, TO, 1000000n)).rejects.toThrow(/contract type/i);
    expect(SecureKeyring.signHash).not.toHaveBeenCalled();
  });
});

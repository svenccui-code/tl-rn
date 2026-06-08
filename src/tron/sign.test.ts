import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { signTronTx, signTronTxMulti } from './sign';
import { TRON_GOLDEN } from './tronGolden';

const unsigned = { txID: TRON_GOLDEN.txId, raw_data: {}, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true };

describe('signTronTx', () => {
  it('signs the txID via signHash(195) and appends bare-hex signature', async () => {
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue('0x' + 'ab'.repeat(65));
    const signed = await signTronTx(unsigned as any, 'wref');
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 195, '0x' + TRON_GOLDEN.txId);
    expect(signed.signature).toEqual(['ab'.repeat(65)]);
  });
  it('multisig appends one signature per walletRef', async () => {
    (SecureKeyring.signHash as jest.Mock)
      .mockResolvedValueOnce('0x' + '11'.repeat(65))
      .mockResolvedValueOnce('0x' + '22'.repeat(65));
    const signed = await signTronTxMulti(unsigned as any, ['w1', 'w2']);
    expect(signed.signature).toEqual(['11'.repeat(65), '22'.repeat(65)]);
  });
  it('signs the LOCAL txID even if tx.txID is tampered', async () => {
    (SecureKeyring.signHash as jest.Mock).mockResolvedValue('0x' + 'ab'.repeat(65));
    const tampered = { txID: 'deadbeef'.padEnd(64, '0'), raw_data: {}, raw_data_hex: TRON_GOLDEN.rawDataHex, visible: true };
    await signTronTx(tampered as any, 'wref');
    expect(SecureKeyring.signHash).toHaveBeenCalledWith('wref', 195, '0x' + TRON_GOLDEN.txId); // local, not deadbeef
  });
});

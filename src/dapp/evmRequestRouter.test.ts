import { handleEvmRequest, EvmDappContext } from './evmRequestRouter';
import { jsonRpc } from '../net/jsonRpc';
jest.mock('../net/jsonRpc');

const ctx: EvmDappContext = {
  address: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  chainIdHex: '0x1',
  config: { caip2: 'eip155:1', rpc: { primary: 'https://rpc', fallback: [] } } as any,
  walletRef: 'wref',
  signTransaction: jest.fn(async () => '0xsignedraw'),
  broadcast: jest.fn(async () => '0xtxhash'),
  personalSign: jest.fn(async () => '0xsig'),
  confirm: jest.fn(async () => true),
};

describe('handleEvmRequest', () => {
  it('returns the account for eth_requestAccounts/eth_accounts', async () => {
    await expect(handleEvmRequest('eth_requestAccounts', [], ctx)).resolves.toEqual([ctx.address]);
    await expect(handleEvmRequest('eth_accounts', [], ctx)).resolves.toEqual([ctx.address]);
  });
  it('returns chainId and net_version', async () => {
    await expect(handleEvmRequest('eth_chainId', [], ctx)).resolves.toBe('0x1');
    await expect(handleEvmRequest('net_version', [], ctx)).resolves.toBe('1');
  });
  it('signs + broadcasts eth_sendTransaction (after confirm)', async () => {
    const hash = await handleEvmRequest('eth_sendTransaction', [{ to: ctx.address, value: '0x1' }], ctx);
    expect(ctx.confirm).toHaveBeenCalled();
    expect(ctx.signTransaction).toHaveBeenCalled();
    expect(ctx.broadcast).toHaveBeenCalledWith('0xsignedraw');
    expect(hash).toBe('0xtxhash');
  });
  it('rejects eth_sendTransaction when the user declines', async () => {
    const decline = { ...ctx, confirm: jest.fn(async () => false) };
    await expect(handleEvmRequest('eth_sendTransaction', [{ to: ctx.address, value: '0x1' }], decline))
      .rejects.toMatchObject({ code: 4001 });
  });
  it('routes personal_sign to the signer', async () => {
    await expect(handleEvmRequest('personal_sign', ['0x68656c6c6f', ctx.address], ctx)).resolves.toBe('0xsig');
  });
  it('forwards unknown read methods to RPC', async () => {
    (jsonRpc as jest.Mock).mockResolvedValue('0xdead');
    await expect(handleEvmRequest('eth_blockNumber', [], ctx)).resolves.toBe('0xdead');
    expect(jsonRpc).toHaveBeenCalledWith(ctx.config.rpc, 'eth_blockNumber', []);
  });
});

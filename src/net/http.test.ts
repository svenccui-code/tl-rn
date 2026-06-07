/// <reference types="jest" />
import { withFailover, httpJson } from './http';
import { jsonRpc } from './jsonRpc';

declare const global: any;

describe('withFailover', () => {
  it('returns the primary result when it succeeds', async () => {
    const r = await withFailover({ primary: 'A', fallback: ['B'] }, async base => base);
    expect(r).toBe('A');
  });

  it('falls back when the primary throws', async () => {
    const r = await withFailover({ primary: 'A', fallback: ['B', 'C'] }, async base => {
      if (base === 'A') throw new Error('down');
      return base;
    });
    expect(r).toBe('B');
  });

  it('throws the last error when all fail', async () => {
    await expect(
      withFailover({ primary: 'A', fallback: ['B'] }, async () => { throw new Error('all down'); }),
    ).rejects.toThrow('all down');
  });
});

describe('jsonRpc', () => {
  afterEach(() => { (global.fetch as jest.Mock)?.mockReset?.(); });

  it('posts a JSON-RPC body and returns result', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x1a' }),
    });
    const res = await jsonRpc({ primary: 'https://rpc', fallback: [] }, 'eth_getBalance', ['0xabc', 'latest']);
    expect(res).toBe('0x1a');
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_getBalance');
    expect(body.params).toEqual(['0xabc', 'latest']);
  });

  it('throws on rpc error payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ error: { message: 'bad' } }),
    });
    await expect(jsonRpc({ primary: 'https://rpc', fallback: [] }, 'eth_call', [])).rejects.toThrow('bad');
  });
});

# TronLink RN — Phase 1「地基」Read-Only Multichain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the config-driven, read-only multichain layer on top of the proven Phase-0 `SecureKeyring` bridge: a CAIP-2 chain registry, a unified `ChainAdapter` interface with `EvmAdapter`/`TronAdapter` (family reuse), a failover RPC layer, and a cross-chain account tree that derives addresses and reads balances — with **zero funds at risk** (no signing, no broadcasting).

**Architecture:** RN/TS only; calls the existing native `SecureKeyring` TurboModule for derivation/validation and HTTPS endpoints for balances (EVM JSON-RPC `eth_getBalance`/`eth_call`; TRON TronGrid REST). Adding an EVM chain = adding one registry row (all EVM chains share `EvmAdapter` and the `m/44'/60'` address); adding a new family = one new adapter. Signing/broadcast (`buildTransaction`/`sign`/`broadcast`) are intentionally **out of scope** (Phase 2 EVM / Phase 3 TRON).

**Tech Stack:** TypeScript · React Native 0.84 · the Phase-0 `SecureKeyring` bridge · `fetch` (EVM JSON-RPC + TronGrid REST) · Jest (mocked `fetch` + mocked bridge). No new heavy dependencies — ERC-20 `balanceOf` ABI encoding/decoding is hand-coded.

**Prerequisite (carried from Phase 0):** the §7 human cross-check (golden TRON address `TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH` == real TronLink) should ideally be done before trusting derived addresses for real users; it does not block read-only development.

**Scope discipline (YAGNI):** Phase 1's adapter is **read-only** — `deriveAddress`, `validateAddress`, `getNativeBalance`, `getTokenBalance`. The full `ChainAdapter` (with `buildTransaction`/`sign`/`broadcast`/`decode`) arrives in Phase 2 as `SigningChainAdapter extends ChainAdapter`. Multicall batching is a documented Phase-1.5 optimization; Phase 1 uses individual `eth_call` / TronGrid account lookups (simpler, fully testable).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/chain-registry/types.ts` | `ChainConfig`, `Caip2`, `ChainFamily` types |
| `src/chain-registry/chains.ts` | `CHAINS` registry + `getChain` / `chainsByFamily` lookups |
| `src/chain-registry/chains.test.ts` | registry unit tests |
| `src/net/http.ts` | `httpJson` + `withFailover` (primary→fallback) |
| `src/net/jsonRpc.ts` | EVM JSON-RPC call over `withFailover` |
| `src/net/http.test.ts` | failover + json-rpc unit tests (mocked `fetch`) |
| `src/chain-adapter/abi.ts` | hand-coded ERC-20 `balanceOf` encode + uint256 decode |
| `src/chain-adapter/abi.test.ts` | ABI vector tests |
| `src/chain-adapter/types.ts` | `ReadOnlyChainAdapter`, `TokenRef` |
| `src/chain-adapter/EvmAdapter.ts` | EVM read-only adapter |
| `src/chain-adapter/EvmAdapter.test.ts` | mocked bridge + fetch |
| `src/chain-adapter/TronAdapter.ts` | TRON read-only adapter |
| `src/chain-adapter/TronAdapter.test.ts` | mocked fetch |
| `src/chain-adapter/getAdapter.ts` | factory: `ChainConfig` → adapter (by family) |
| `src/multichain/accountTree.ts` | derive all chain addresses for a walletRef |
| `src/multichain/accountTree.test.ts` | mocked bridge |
| `src/devtools/ReadOnlySelfTest.ts` | on-device capstone: derive tree + read balances |
| `App.tsx` | add read-only self-test (auto-run + sentinel logs) |
| `docs/phase1-readonly.md` | Phase-1 exit gate doc |

---

## Task 1: Chain registry (config-driven)

**Files:**
- Create: `src/chain-registry/types.ts`, `src/chain-registry/chains.ts`
- Test: `src/chain-registry/chains.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/chain-registry/chains.test.ts
import { CHAINS, getChain, chainsByFamily } from './chains';

describe('chain registry', () => {
  it('contains TRON, Ethereum and BSC', () => {
    expect(CHAINS.map(c => c.caip2).sort()).toEqual(
      ['eip155:1', 'eip155:56', 'tron:728126428'].sort(),
    );
  });

  it('looks up a chain by caip2', () => {
    expect(getChain('eip155:1')?.nativeSymbol).toBe('ETH');
    expect(getChain('tron:728126428')?.coinType).toBe(195);
    expect(getChain('nope')).toBeUndefined();
  });

  it('groups EVM chains (all share coinType 60)', () => {
    const evm = chainsByFamily('evm');
    expect(evm.length).toBe(2);
    expect(evm.every(c => c.coinType === 60)).toBe(true);
  });

  it('every chain has primary rpc + explorer + decimals', () => {
    for (const c of CHAINS) {
      expect(c.rpc.primary).toMatch(/^https:\/\//);
      expect(c.explorerTx).toMatch(/^https:\/\//);
      expect(c.decimals).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/viccc/working/rn_eth/tronlink-rn && yarn jest src/chain-registry/chains.test.ts --watchman=false`
Expected: FAIL — `Cannot find module './chains'`.

- [ ] **Step 3: Write the types**

```typescript
// src/chain-registry/types.ts
export type Caip2 = string;            // 'eip155:1' | 'tron:728126428'
export type ChainFamily = 'evm' | 'tron';

export interface ChainConfig {
  caip2: Caip2;
  coinType: number;                    // TWCore CoinType: 60 (EVM) | 195 (TRON)
  family: ChainFamily;                 // selects the adapter
  name: string;
  nativeSymbol: string;
  decimals: number;
  rpc: { primary: string; fallback: string[] };
  explorerTx: string;                  // base url; append tx hash
  capabilities: { dapp: boolean; nft: boolean; defi: boolean };
}
```

- [ ] **Step 4: Write the registry**

```typescript
// src/chain-registry/chains.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn jest src/chain-registry/chains.test.ts --watchman=false`
Expected: PASS (4 passing).

- [ ] **Step 6: Commit**

```bash
git add src/chain-registry/
git commit -m "feat: add config-driven CAIP-2 chain registry (TRON, ETH, BSC)"
```

---

## Task 2: Failover HTTP + JSON-RPC layer

**Files:**
- Create: `src/net/http.ts`, `src/net/jsonRpc.ts`
- Test: `src/net/http.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/net/http.test.ts
import { withFailover, httpJson } from './http';
import { jsonRpc } from './jsonRpc';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/net/http.test.ts --watchman=false`
Expected: FAIL — cannot find `./http` / `./jsonRpc`.

- [ ] **Step 3: Write `http.ts`**

```typescript
// src/net/http.ts
export interface Endpoints { primary: string; fallback: string[]; }

export async function httpJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Try primary, then each fallback in order. Throw the last error if all fail.
export async function withFailover<T>(
  endpoints: Endpoints,
  fn: (base: string) => Promise<T>,
): Promise<T> {
  const bases = [endpoints.primary, ...endpoints.fallback];
  let lastErr: unknown = new Error('no endpoints configured');
  for (const base of bases) {
    try {
      return await fn(base);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: Write `jsonRpc.ts`**

```typescript
// src/net/jsonRpc.ts
import { Endpoints, httpJson, withFailover } from './http';

export async function jsonRpc(
  endpoints: Endpoints,
  method: string,
  params: unknown[],
): Promise<any> {
  return withFailover(endpoints, async base => {
    const r = await httpJson(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (r.error) throw new Error(`RPC ${method}: ${r.error.message ?? 'error'}`);
    return r.result;
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn jest src/net/http.test.ts --watchman=false`
Expected: PASS (5 passing).

- [ ] **Step 6: Commit**

```bash
git add src/net/
git commit -m "feat: add failover HTTP + JSON-RPC client"
```

---

## Task 3: ERC-20 ABI helpers (hand-coded)

**Files:**
- Create: `src/chain-adapter/abi.ts`
- Test: `src/chain-adapter/abi.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/chain-adapter/abi.test.ts
import { erc20BalanceOfData, decodeUint256 } from './abi';

describe('erc20BalanceOfData', () => {
  it('encodes selector + left-padded address', () => {
    const data = erc20BalanceOfData('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(data).toBe(
      '0x70a08231' +
      '000000000000000000000000' +
      '9858effd232b4033e47d90003d41ec34ecaeda94',
    );
    expect(data.length).toBe(2 + 8 + 64); // 0x + selector + 32-byte word
  });

  it('rejects malformed addresses', () => {
    expect(() => erc20BalanceOfData('0x1234')).toThrow();
  });
});

describe('decodeUint256', () => {
  it('decodes hex to bigint', () => {
    expect(decodeUint256('0x0de0b6b3a7640000')).toBe(1000000000000000000n);
  });
  it('treats empty/0x as zero', () => {
    expect(decodeUint256('0x')).toBe(0n);
    expect(decodeUint256('')).toBe(0n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/chain-adapter/abi.test.ts --watchman=false`
Expected: FAIL — cannot find `./abi`.

- [ ] **Step 3: Write `abi.ts`**

```typescript
// src/chain-adapter/abi.ts
// ERC-20 balanceOf(address) selector = keccak256("balanceOf(address)")[0:4].
const BALANCE_OF_SELECTOR = '0x70a08231';

export function erc20BalanceOfData(address: string): string {
  const addr = address.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(addr)) {
    throw new Error(`invalid EVM address: ${address}`);
  }
  return BALANCE_OF_SELECTOR + addr.padStart(64, '0');
}

export function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest src/chain-adapter/abi.test.ts --watchman=false`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/chain-adapter/abi.ts src/chain-adapter/abi.test.ts
git commit -m "feat: add hand-coded ERC-20 balanceOf ABI helpers"
```

---

## Task 4: ReadOnlyChainAdapter interface + types

**Files:**
- Create: `src/chain-adapter/types.ts`
- Test: `src/chain-adapter/types.test.ts`

- [ ] **Step 1: Write the failing test** (a compile-time contract check via a stub implementation)

```typescript
// src/chain-adapter/types.test.ts
import type { ReadOnlyChainAdapter, TokenRef } from './types';
import type { ChainConfig } from '../chain-registry/types';

const cfg: ChainConfig = {
  caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'X', nativeSymbol: 'X',
  decimals: 18, rpc: { primary: 'https://x', fallback: [] }, explorerTx: 'https://x/',
  capabilities: { dapp: false, nft: false, defi: false },
};

// A stub that satisfies the interface — proves the shape compiles & is usable.
const stub: ReadOnlyChainAdapter = {
  config: cfg,
  deriveAddress: async () => '0xabc',
  validateAddress: () => true,
  getNativeBalance: async () => 0n,
  getTokenBalance: async (_a: string, _t: TokenRef) => 0n,
};

describe('ReadOnlyChainAdapter shape', () => {
  it('exposes config + 4 read methods', async () => {
    expect(stub.config.caip2).toBe('eip155:1');
    expect(stub.validateAddress('0xabc')).toBe(true);
    await expect(stub.getNativeBalance('0xabc')).resolves.toBe(0n);
    await expect(
      stub.getTokenBalance('0xabc', { address: '0xtok', decimals: 6 }),
    ).resolves.toBe(0n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/chain-adapter/types.test.ts --watchman=false`
Expected: FAIL — cannot find `./types`.

- [ ] **Step 3: Write `types.ts`**

```typescript
// src/chain-adapter/types.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest src/chain-adapter/types.test.ts --watchman=false`
Expected: PASS (1 passing).

- [ ] **Step 5: Commit**

```bash
git add src/chain-adapter/types.ts src/chain-adapter/types.test.ts
git commit -m "feat: define read-only ChainAdapter interface and TokenRef"
```

---

## Task 5: EvmAdapter (read-only)

**Files:**
- Create: `src/chain-adapter/EvmAdapter.ts`
- Test: `src/chain-adapter/EvmAdapter.test.ts`

**Context:** `SecureKeyring` is auto-mocked in Jest (Phase-0 `src/native-bridge/__mocks__/NativeSecureKeyring.ts` + `jest.setup.js`). Tests set per-test return values on the mocked methods.

- [ ] **Step 1: Write the failing test**

```typescript
// src/chain-adapter/EvmAdapter.test.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { EvmAdapter } from './EvmAdapter';
import type { ChainConfig } from '../chain-registry/types';

const ETH: ChainConfig = {
  caip2: 'eip155:1', coinType: 60, family: 'evm', name: 'Ethereum', nativeSymbol: 'ETH',
  decimals: 18, rpc: { primary: 'https://rpc', fallback: [] }, explorerTx: 'https://e/',
  capabilities: { dapp: true, nft: true, defi: true },
};

describe('EvmAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('derives the address via the bridge with coinType 60', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockResolvedValue('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    const a = new EvmAdapter(ETH);
    await expect(a.deriveAddress('ref')).resolves.toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(SecureKeyring.deriveAddress).toHaveBeenCalledWith('ref', 60);
  });

  it('reads native balance via eth_getBalance', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0x0de0b6b3a7640000' }) });
    const a = new EvmAdapter(ETH);
    await expect(a.getNativeBalance('0xabc')).resolves.toBe(1000000000000000000n);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_getBalance');
    expect(body.params).toEqual(['0xabc', 'latest']);
  });

  it('reads token balance via eth_call balanceOf', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0x0000000000000000000000000000000000000000000000000000000000000064' }) });
    const a = new EvmAdapter(ETH);
    const bal = await a.getTokenBalance('0x9858EfFD232B4033E47d90003D41EC34EcaEda94', { address: '0xToKeN', decimals: 6 });
    expect(bal).toBe(100n);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.method).toBe('eth_call');
    expect(body.params[0].to).toBe('0xToKeN');
    expect(body.params[0].data).toMatch(/^0x70a08231/);
  });

  it('validates addresses via the bridge', () => {
    (SecureKeyring.validateAddress as jest.Mock).mockReturnValue(true);
    expect(new EvmAdapter(ETH).validateAddress('0xabc')).toBe(true);
    expect(SecureKeyring.validateAddress).toHaveBeenCalledWith('0xabc', 60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/chain-adapter/EvmAdapter.test.ts --watchman=false`
Expected: FAIL — cannot find `./EvmAdapter`.

- [ ] **Step 3: Write `EvmAdapter.ts`**

```typescript
// src/chain-adapter/EvmAdapter.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import type { ChainConfig } from '../chain-registry/types';
import { jsonRpc } from '../net/jsonRpc';
import { decodeUint256, erc20BalanceOfData } from './abi';
import type { ReadOnlyChainAdapter, TokenRef } from './types';

export class EvmAdapter implements ReadOnlyChainAdapter {
  constructor(public readonly config: ChainConfig) {}

  deriveAddress(walletRef: string): Promise<string> {
    return SecureKeyring.deriveAddress(walletRef, this.config.coinType);
  }

  validateAddress(address: string): boolean {
    return SecureKeyring.validateAddress(address, this.config.coinType);
  }

  async getNativeBalance(address: string): Promise<bigint> {
    const hex = await jsonRpc(this.config.rpc, 'eth_getBalance', [address, 'latest']);
    return decodeUint256(hex);
  }

  async getTokenBalance(address: string, token: TokenRef): Promise<bigint> {
    const hex = await jsonRpc(this.config.rpc, 'eth_call', [
      { to: token.address, data: erc20BalanceOfData(address) },
      'latest',
    ]);
    return decodeUint256(hex);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest src/chain-adapter/EvmAdapter.test.ts --watchman=false`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/chain-adapter/EvmAdapter.ts src/chain-adapter/EvmAdapter.test.ts
git commit -m "feat: add read-only EvmAdapter (derive + native/token balance)"
```

---

## Task 6: TronAdapter (read-only)

**Files:**
- Create: `src/chain-adapter/TronAdapter.ts`
- Test: `src/chain-adapter/TronAdapter.test.ts`

**TRON read endpoints (TronGrid REST):** native via `POST {base}/wallet/getaccount {address, visible:true}` (returns `{balance: <sun>}`, or `{}` for an unactivated account = 0); TRC-20 via `GET {base}/v1/accounts/{address}` whose `data[0].trc20` is an array of `{ <contractAddress>: "<amount>" }` maps.

- [ ] **Step 1: Write the failing test**

```typescript
// src/chain-adapter/TronAdapter.test.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { TronAdapter } from './TronAdapter';
import type { ChainConfig } from '../chain-registry/types';

const TRON: ChainConfig = {
  caip2: 'tron:728126428', coinType: 195, family: 'tron', name: 'TRON', nativeSymbol: 'TRX',
  decimals: 6, rpc: { primary: 'https://trongrid', fallback: [] }, explorerTx: 'https://t/',
  capabilities: { dapp: true, nft: true, defi: true },
};
const ADDR = 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH';

describe('TronAdapter', () => {
  afterEach(() => (global.fetch as jest.Mock)?.mockReset?.());

  it('derives via the bridge with coinType 195', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockResolvedValue(ADDR);
    await expect(new TronAdapter(TRON).deriveAddress('ref')).resolves.toBe(ADDR);
    expect(SecureKeyring.deriveAddress).toHaveBeenCalledWith('ref', 195);
  });

  it('reads native TRX balance from /wallet/getaccount', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 12345678 }) });
    await expect(new TronAdapter(TRON).getNativeBalance(ADDR)).resolves.toBe(12345678n);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('https://trongrid/wallet/getaccount');
    expect(JSON.parse(call[1].body)).toEqual({ address: ADDR, visible: true });
  });

  it('returns 0 for an unactivated account ({} response)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(new TronAdapter(TRON).getNativeBalance(ADDR)).resolves.toBe(0n);
  });

  it('reads a TRC20 balance from /v1/accounts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ trc20: [{ 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t': '500000' }] }] }),
    });
    const bal = await new TronAdapter(TRON).getTokenBalance(ADDR, {
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6, symbol: 'USDT',
    });
    expect(bal).toBe(500000n);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(`https://trongrid/v1/accounts/${ADDR}`);
  });

  it('returns 0 when the token is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ trc20: [] }] }) });
    await expect(
      new TronAdapter(TRON).getTokenBalance(ADDR, { address: 'TXxx', decimals: 6 }),
    ).resolves.toBe(0n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/chain-adapter/TronAdapter.test.ts --watchman=false`
Expected: FAIL — cannot find `./TronAdapter`.

- [ ] **Step 3: Write `TronAdapter.ts`**

```typescript
// src/chain-adapter/TronAdapter.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest src/chain-adapter/TronAdapter.test.ts --watchman=false`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/chain-adapter/TronAdapter.ts src/chain-adapter/TronAdapter.test.ts
git commit -m "feat: add read-only TronAdapter (derive + TRX/TRC20 balance)"
```

---

## Task 7: Adapter factory + cross-chain account tree

**Files:**
- Create: `src/chain-adapter/getAdapter.ts`, `src/multichain/accountTree.ts`
- Test: `src/multichain/accountTree.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/multichain/accountTree.test.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { buildAccountTree } from './accountTree';
import { getAdapter } from '../chain-adapter/getAdapter';
import { getChain } from '../chain-registry/chains';

describe('getAdapter', () => {
  it('returns EvmAdapter for evm chains and TronAdapter for tron', () => {
    expect(getAdapter(getChain('eip155:1')!).constructor.name).toBe('EvmAdapter');
    expect(getAdapter(getChain('tron:728126428')!).constructor.name).toBe('TronAdapter');
  });
});

describe('buildAccountTree', () => {
  it('derives one entry per registered chain, EVM chains sharing one address', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockImplementation(
      async (_ref: string, coinType: number) =>
        coinType === 60 ? '0x9858EfFD232B4033E47d90003D41EC34EcaEda94' : 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH',
    );
    const tree = await buildAccountTree('ref');
    expect(tree).toHaveLength(3);
    const eth = tree.find(t => t.caip2 === 'eip155:1')!;
    const bsc = tree.find(t => t.caip2 === 'eip155:56')!;
    const tron = tree.find(t => t.caip2 === 'tron:728126428')!;
    expect(eth.address).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(bsc.address).toBe(eth.address);            // EVM family shares the address
    expect(tron.address).toBe('TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH');
    expect(eth.nativeSymbol).toBe('ETH');
  });

  it('derives each coinType only once (EVM address reused across EVM chains)', async () => {
    (SecureKeyring.deriveAddress as jest.Mock).mockClear();
    (SecureKeyring.deriveAddress as jest.Mock).mockResolvedValue('0xaddr');
    await buildAccountTree('ref');
    const coinTypes = (SecureKeyring.deriveAddress as jest.Mock).mock.calls.map(c => c[1]).sort();
    expect(coinTypes).toEqual([60, 195]); // 60 once (shared), 195 once — not 3 calls
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest src/multichain/accountTree.test.ts --watchman=false`
Expected: FAIL — cannot find `./accountTree` / `../chain-adapter/getAdapter`.

- [ ] **Step 3: Write `getAdapter.ts`**

```typescript
// src/chain-adapter/getAdapter.ts
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
```

- [ ] **Step 4: Write `accountTree.ts`**

```typescript
// src/multichain/accountTree.ts
import { CHAINS } from '../chain-registry/chains';
import { getAdapter } from '../chain-adapter/getAdapter';

export interface ChainAccount {
  caip2: string;
  name: string;
  address: string;
  nativeSymbol: string;
}

// Derive an address for every registered chain. Addresses are derived once per
// coinType (so all EVM chains reuse the single m/44'/60' address) and reused.
export async function buildAccountTree(walletRef: string): Promise<ChainAccount[]> {
  const byCoinType = new Map<number, Promise<string>>();
  const out: ChainAccount[] = [];
  for (const config of CHAINS) {
    let p = byCoinType.get(config.coinType);
    if (!p) {
      p = getAdapter(config).deriveAddress(walletRef);
      byCoinType.set(config.coinType, p);
    }
    out.push({
      caip2: config.caip2,
      name: config.name,
      address: await p,
      nativeSymbol: config.nativeSymbol,
    });
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn jest src/multichain/accountTree.test.ts --watchman=false`
Expected: PASS (3 passing).

- [ ] **Step 6: Commit**

```bash
git add src/chain-adapter/getAdapter.ts src/multichain/accountTree.ts src/multichain/accountTree.test.ts
git commit -m "feat: add adapter factory and cross-chain account tree"
```

---

## Task 8: On-device read-only capstone self-test (both platforms)

Proves the read path end-to-end on real devices: derive the account tree via the live bridge (addresses must equal the golden constants), then hit real RPC/TronGrid endpoints for balances (must resolve without error; value ≥ 0 — the golden mnemonic is unfunded). Headless-verifiable via sentinel logs (same pattern as Phase-0 Task 8).

**Files:**
- Create: `src/devtools/ReadOnlySelfTest.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Write the self-test**

```typescript
// src/devtools/ReadOnlySelfTest.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';
import { CHAINS, getChain } from '../chain-registry/chains';
import { buildAccountTree } from '../multichain/accountTree';
import { getAdapter } from '../chain-adapter/getAdapter';

export type Line = { name: string; ok: boolean; detail: string };

export async function runReadOnlySelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);

  const tree = await buildAccountTree(ref);
  for (const acct of tree) {
    const expected =
      getChain(acct.caip2)!.family === 'evm' ? GOLDEN.evm.expectedAddress : GOLDEN.tron.expectedAddress;
    out.push({ name: `derive ${acct.name}`, ok: acct.address === expected, detail: acct.address });
  }

  // Real balance reads — must resolve (>= 0n). Network errors fail the line.
  for (const config of CHAINS) {
    const adapter = getAdapter(config);
    const addr = tree.find(t => t.caip2 === config.caip2)!.address;
    try {
      const bal = await adapter.getNativeBalance(addr);
      out.push({ name: `balance ${config.name}`, ok: bal >= 0n, detail: `${bal} ${config.nativeSymbol}` });
    } catch (e) {
      out.push({ name: `balance ${config.name}`, ok: false, detail: `ERR ${String(e)}` });
    }
  }

  await SecureKeyring.deleteWallet(ref);
  return out;
}
```

- [ ] **Step 2: Wire it into `App.tsx`** (add alongside the Phase-0 self-test; auto-run + sentinels)

```tsx
// App.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, Button, View } from 'react-native';
import { runBridgeSelfTest, Line } from './src/devtools/BridgeSelfTest';
import { runReadOnlySelfTest } from './src/devtools/ReadOnlySelfTest';

async function runAndLog(tag: string, fn: () => Promise<Line[]>, set: (l: Line[]) => void) {
  try {
    const lines = await fn();
    set(lines);
    const allOk = lines.every(l => l.ok);
    console.log(`${tag}_BEGIN`);
    lines.forEach(l => console.log(`${tag}_LINE ${l.ok ? 'PASS' : 'FAIL'} ${l.name} | ${l.detail}`));
    console.log(`${tag}_RESULT=${allOk ? 'ALL_PASS' : 'FAIL'}`);
    console.log(`${tag}_END`);
  } catch (e) {
    console.log(`${tag}_RESULT=ERROR ${String(e)}`);
  }
}

export default function App() {
  const [bridge, setBridge] = useState<Line[]>([]);
  const [readonly, setReadonly] = useState<Line[]>([]);
  useEffect(() => {
    runAndLog('SELFTEST', runBridgeSelfTest, setBridge);
    runAndLog('READONLY', runReadOnlySelfTest, setReadonly);
  }, []);
  const render = (title: string, lines: Line[]) => (
    <View>
      <Text style={{ fontSize: 18, marginTop: 12 }}>
        {title}: {lines.length === 0 ? '…' : lines.every(l => l.ok) ? '✅ ALL PASS' : '❌ FAIL'}
      </Text>
      {lines.map((l, i) => (
        <Text key={i}>{l.ok ? '✅' : '❌'} {l.name}: {l.detail}</Text>
      ))}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Button title="Re-run" onPress={() => {
        runAndLog('SELFTEST', runBridgeSelfTest, setBridge);
        runAndLog('READONLY', runReadOnlySelfTest, setReadonly);
      }} />
      <ScrollView>{render('SecureKeyring', bridge)}{render('Read-only multichain', readonly)}</ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Typecheck + Jest still green**

Run: `yarn tsc --noEmit && yarn jest --watchman=false 2>&1 | tail -4`
Expected: tsc clean; all Jest suites pass (the auto-mocked bridge makes `runReadOnlySelfTest` render-safe in the App test; unit suites unaffected).

- [ ] **Step 4: Android device verification**

```bash
adb logcat -c
npx react-native run-android   # Metro must be running
# wait ~10s for network reads, then:
adb logcat -d | grep -E "READONLY_" | tail -20
```
Expected: `READONLY_LINE PASS derive Ethereum | 0x9858…`, `... derive BNB Smart Chain | 0x9858…`, `... derive TRON | TUEZ…`, `balance Ethereum | 0 ETH` (or a real value), …, `READONLY_RESULT=ALL_PASS`. Capture the lines. (If a public RPC is flaky, a `balance` line may ERR — retry; if a specific endpoint is down, switch its `rpc.primary` in `chains.ts`. Derive lines must always PASS.)

- [ ] **Step 5: iOS device verification**

```bash
npx react-native start --client-logs &   # RN 0.84 routes console.log here
npx react-native run-ios --simulator "iPhone 17 Pro"
# read the Metro stdout for READONLY_ lines
```
Expected: same `READONLY_RESULT=ALL_PASS` with golden addresses and resolved balances. Capture the lines.

- [ ] **Step 6: Commit** (only after both platforms show derive lines PASS and READONLY_RESULT=ALL_PASS)

```bash
git add src/devtools/ReadOnlySelfTest.ts App.tsx
git commit -m "test: on-device read-only multichain self-test (address parity + live balances)"
```

---

## Task 9: Phase-1 exit gate documentation

**Files:**
- Create: `docs/phase1-readonly.md`

- [ ] **Step 1: Write the doc**

Write `docs/phase1-readonly.md` capturing: what Phase 1 delivers (registry + read-only adapters + account tree), the exit criteria below with evidence (which test/log proves each), the supported chains (TRON/ETH/BSC) and how to add more (one registry row for EVM; one adapter for a new family), the public-RPC→self-gateway follow-up, and the Phase-1→Phase-2 handoff (signing: `SigningChainAdapter` + `buildTransaction`/`sign` via the bridge + `broadcast`).

Exit criteria (all must be ✅):
1. All Jest suites pass (`yarn jest --watchman=false`) — registry, http/jsonRpc, abi, types, EvmAdapter, TronAdapter, accountTree.
2. `yarn tsc --noEmit` clean.
3. On-device read-only self-test: `READONLY_RESULT=ALL_PASS` on both iOS and Android, derive lines matching golden addresses, balance reads resolving.

- [ ] **Step 2: Commit**

```bash
git add docs/phase1-readonly.md
git commit -m "docs: record Phase-1 read-only multichain exit gate"
```

---

## Self-Review

**Spec coverage (architecture §4 + handoff Phase-1 definition):**
- §4.2 config-driven chain registry (CAIP-2 + capabilities) → Task 1. ✅
- §4.1 unified ChainAdapter interface (read-only slice) + family grouping (EVM shares one adapter & address) → Tasks 4/5/6/7. ✅
- Read-only deliverables: account tree, address derivation, balance display (EVM `eth_getBalance`/`eth_call`; TRON TronGrid) → Tasks 5/6/7/8. ✅
- Failover RPC (self gateway + public fallback shape) → Task 2 (public endpoints now; self-gateway noted as follow-up). ✅
- "Add EVM chain = add a row; add family = add an adapter" → proven by registry + factory + account tree (Tasks 1/7). ✅
- Zero funds at risk: no `buildTransaction`/`sign`/`broadcast`/`decode` implemented — explicitly deferred to Phase 2/3. ✅ (scoped)
- EVM multicall batching → documented as Phase-1.5 optimization; Phase 1 uses individual `eth_call`. ✅ (scoped)

**Placeholder scan:** Every step has real, runnable code + exact run commands and expected output. No "TBD"/"add error handling"/"similar to". The only deferred items (multicall, signing methods, self-gateway URLs) are explicit, justified scope boundaries, not lazy gaps.

**Type consistency:** `ChainConfig` (Task 1) is consumed unchanged by `ReadOnlyChainAdapter.config` (Task 4), both adapters (5/6), the factory (7) and account tree (7). `ReadOnlyChainAdapter` method set — `config`, `deriveAddress`, `validateAddress` (sync `boolean`), `getNativeBalance`→`Promise<bigint>`, `getTokenBalance(address, TokenRef)`→`Promise<bigint>` — matches the stub (Task 4), `EvmAdapter`, `TronAdapter`, and the self-test usage (Task 8). `Endpoints {primary, fallback}` (Task 2) matches `ChainConfig.rpc` shape, passed directly into `jsonRpc`/`withFailover`. `SecureKeyring.deriveAddress(ref, coinType)` / `validateAddress(addr, coinType)` match the Phase-0 spec. `getChain`/`chainsByFamily`/`CHAINS` names consistent across Tasks 1/7/8.

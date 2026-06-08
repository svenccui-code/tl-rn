# TronLink RN — State Layer Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the project's mandated layered/decoupled state layer per [`docs/state-layer-design.md`](../../state-layer-design.md): **Zustand stores** (stateful, ≈Controller) + **stateless services** (IO/orchestration, ≈Service) + a **typed mitt EventBus** (cross-domain, ≈Messenger) + **container.ts** (DI assembly, ≈Engine init) — sitting on top of the existing, device-proven `chain-adapter` / `native-bridge` / `multichain` / `net` layers.

**Architecture (the three iron rules, from MetaMask via `state-layer-design.md`):** (1) UI reads state ONLY via store selectors; (2) services are stateless — they read store / write store / emit events / call IO, holding no business state; (3) single ownership — each slice of state has exactly one owning store; cross-domain coupling goes through the EventBus, never direct store↔store or service↔service imports (no cycles). Reference implementation: `/Users/viccc/source/metamask-mobile` (Controller/Service/Messenger).

**Tech Stack:** TypeScript · `zustand` (stores) · `mitt` (typed event bus) · the existing `chain-adapter`/`native-bridge`/`multichain` layers · Jest. Both deps are tiny pure-JS, Hermes-compatible, no polyfills.

**Scope (this plan — non-speculative core only, per `state-layer-design.md` §7 YAGNI):** the bus + the four domains that have REAL backing data flows today — Network, Assets, Wallet, Tx — and the four services that wrap existing working code — Keyring, Balance, Broadcast, TxStatus — plus the DI container. **Deferred until their features are built:** `SettingsStore`, `DappStore`, `PriceService`, `DappRequestService`, `NodeService` (add per the doc when the corresponding UI/feature lands). No UI components in this plan (the layer is the foundation UI will consume).

**Key invariant preserved:** services orchestrate but never touch cryptography/private keys — signing stays in `chain-adapter` → `SecureKeyring.signHash` (native). `KeyringService` wraps the bridge for lifecycle/derivation only.

---

## File Structure (new `src/state/`)

| File | Responsibility |
| --- | --- |
| `src/state/bus/events.ts` | `AppEvents` typed event map |
| `src/state/bus/eventBus.ts` | typed `mitt` instance (`bus`) |
| `src/state/stores/NetworkStore.ts` | selected caip2 + per-chain node (single owner) |
| `src/state/stores/AssetsStore.ts` | native/token balances keyed by `caip2:address` |
| `src/state/stores/WalletStore.ts` | walletRef + account tree + locked state |
| `src/state/stores/TxStore.ts` | pending + historical txs |
| `src/state/services/KeyringService.ts` | wraps `native-bridge` (import/derive); emits `wallet/added` |
| `src/state/services/BalanceService.ts` | read adapter → write `AssetsStore` |
| `src/state/services/BroadcastService.ts` | signing adapter broadcast → emit `tx/submitted` |
| `src/state/services/TxStatusService.ts` | poll confirmation → update `TxStore` + emit `tx/confirmed` |
| `src/state/container.ts` | DI: construct services, wire cross-domain bus subscriptions |
| `src/state/*.test.ts` | per `state-layer-design.md` §8 (stores pure; services mocked deps; bus emit→subscriber) |

> Existing `chain-adapter / native-bridge / net / chain-registry / multichain` are NOT modified — the state layer sits on top and orchestrates them.

---

## Task 1: deps + typed EventBus

**Files:** `package.json`; Create `src/state/bus/events.ts`, `src/state/bus/eventBus.ts`; Test `src/state/bus/eventBus.test.ts`

- [ ] **Step 1: Add deps** — `yarn add zustand mitt` (both pure-JS, Hermes-safe, no pod install needed). Record versions.

- [ ] **Step 2: Write failing test**

```typescript
// src/state/bus/eventBus.test.ts
import { bus } from './eventBus';

describe('typed event bus', () => {
  it('delivers a typed event to subscribers', () => {
    const seen: string[] = [];
    const handler = (p: { caip2: string }) => seen.push(p.caip2);
    bus.on('chain/switched', handler);
    bus.emit('chain/switched', { caip2: 'eip155:1' });
    bus.off('chain/switched', handler);
    bus.emit('chain/switched', { caip2: 'eip155:56' }); // not delivered (unsubscribed)
    expect(seen).toEqual(['eip155:1']);
  });
});
```

- [ ] **Step 3: Run — verify FAIL.**

- [ ] **Step 4: Implement**

```typescript
// src/state/bus/events.ts
export type AppEvents = {
  'wallet/added': { walletRef: string };
  'wallet/locked': undefined;
  'account/selected': { caip10: string };
  'chain/switched': { caip2: string };
  'tx/submitted': { caip2: string; hash: string };
  'tx/confirmed': { caip2: string; hash: string; success: boolean };
};
```

```typescript
// src/state/bus/eventBus.ts
import mitt from 'mitt';
import type { AppEvents } from './events';

// Typed pub/sub — the lightweight "Messenger". Cross-domain notification only;
// single-ownership + import boundaries replace MetaMask's restricted-messenger allowlist.
export const bus = mitt<AppEvents>();
```

- [ ] **Step 5: Run — verify PASS; tsc clean.**

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock src/state/bus/
git commit -m "feat(state): add zustand/mitt deps + typed event bus"
```

---

## Task 2: NetworkStore + AssetsStore

**Files:** Create `src/state/stores/NetworkStore.ts`, `src/state/stores/AssetsStore.ts`; Test each `.test.ts`

- [ ] **Step 1: Write failing tests** (pure set→get, no mocks per §8)

```typescript
// src/state/stores/NetworkStore.test.ts
import { useNetworkStore } from './NetworkStore';

describe('NetworkStore', () => {
  beforeEach(() => useNetworkStore.setState({ selectedCaip2: 'tron:728126428', nodeByChain: {} }));
  it('defaults to TRON mainnet', () => {
    expect(useNetworkStore.getState().selectedCaip2).toBe('tron:728126428');
  });
  it('switches chain and sets per-chain node', () => {
    useNetworkStore.getState().setChain('eip155:1');
    useNetworkStore.getState().setNode('eip155:1', 'https://rpc');
    expect(useNetworkStore.getState().selectedCaip2).toBe('eip155:1');
    expect(useNetworkStore.getState().nodeByChain['eip155:1']).toBe('https://rpc');
  });
});
```

```typescript
// src/state/stores/AssetsStore.test.ts
import { useAssetsStore } from './AssetsStore';

describe('AssetsStore', () => {
  beforeEach(() => useAssetsStore.setState({ nativeBalance: {} }));
  it('stores native balance keyed by caip2:address (bigint)', () => {
    useAssetsStore.getState().setNativeBalance('eip155:1', '0xabc', 1000000000000000000n);
    expect(useAssetsStore.getState().nativeBalance['eip155:1:0xabc']).toBe(1000000000000000000n);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/state/stores/NetworkStore.ts
import { create } from 'zustand';

interface NetworkState {
  selectedCaip2: string;
  nodeByChain: Record<string, string>;
  setChain(caip2: string): void;
  setNode(caip2: string, node: string): void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  selectedCaip2: 'tron:728126428',
  nodeByChain: {},
  setChain: (caip2) => set({ selectedCaip2: caip2 }),
  setNode: (caip2, node) => set((s) => ({ nodeByChain: { ...s.nodeByChain, [caip2]: node } })),
}));
```

```typescript
// src/state/stores/AssetsStore.ts
import { create } from 'zustand';

type Key = `${string}:${string}`; // `${caip2}:${address}`
interface AssetsState {
  nativeBalance: Record<Key, bigint>;
  setNativeBalance(caip2: string, address: string, v: bigint): void;
}

export const useAssetsStore = create<AssetsState>((set) => ({
  nativeBalance: {},
  setNativeBalance: (caip2, address, v) =>
    set((s) => ({ nativeBalance: { ...s.nativeBalance, [`${caip2}:${address}`]: v } })),
}));
```

- [ ] **Step 4: Run — verify PASS; tsc clean.**

- [ ] **Step 5: Commit** `git add src/state/stores/NetworkStore.* src/state/stores/AssetsStore.* && git commit -m "feat(state): add NetworkStore + AssetsStore (zustand)"`

---

## Task 3: WalletStore + TxStore

**Files:** Create `src/state/stores/WalletStore.ts`, `src/state/stores/TxStore.ts`; Test each

- [ ] **Step 1: Write failing tests**

```typescript
// src/state/stores/WalletStore.test.ts
import { useWalletStore } from './WalletStore';
import type { ChainAccount } from '../../multichain/accountTree';

describe('WalletStore', () => {
  beforeEach(() => useWalletStore.setState({ walletRef: undefined, accounts: [], locked: true }));
  it('sets the active wallet + account tree and unlocks', () => {
    const accts: ChainAccount[] = [{ caip2: 'eip155:1', name: 'Ethereum', address: '0xabc', nativeSymbol: 'ETH' }];
    useWalletStore.getState().setWallet('ref-1', accts);
    expect(useWalletStore.getState().walletRef).toBe('ref-1');
    expect(useWalletStore.getState().locked).toBe(false);
    expect(useWalletStore.getState().accounts).toHaveLength(1);
  });
  it('lock() clears the ref and re-locks', () => {
    useWalletStore.getState().setWallet('ref-1', []);
    useWalletStore.getState().lock();
    expect(useWalletStore.getState().walletRef).toBeUndefined();
    expect(useWalletStore.getState().locked).toBe(true);
  });
});
```

```typescript
// src/state/stores/TxStore.test.ts
import { useTxStore } from './TxStore';

describe('TxStore', () => {
  beforeEach(() => useTxStore.setState({ byHash: {} }));
  it('adds a pending tx then marks it confirmed', () => {
    useTxStore.getState().addPending({ caip2: 'eip155:1', hash: '0xh', summary: 'send' });
    expect(useTxStore.getState().byHash['0xh'].status).toBe('pending');
    useTxStore.getState().setConfirmed('0xh', true);
    expect(useTxStore.getState().byHash['0xh'].status).toBe('confirmed');
    expect(useTxStore.getState().byHash['0xh'].success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/state/stores/WalletStore.ts
import { create } from 'zustand';
import type { ChainAccount } from '../../multichain/accountTree';

interface WalletState {
  walletRef?: string;
  accounts: ChainAccount[];
  locked: boolean;
  setWallet(walletRef: string, accounts: ChainAccount[]): void;
  lock(): void;
}

export const useWalletStore = create<WalletState>((set) => ({
  walletRef: undefined,
  accounts: [],
  locked: true,
  setWallet: (walletRef, accounts) => set({ walletRef, accounts, locked: false }),
  lock: () => set({ walletRef: undefined, locked: true }),
}));
```

```typescript
// src/state/stores/TxStore.ts
import { create } from 'zustand';

export interface TrackedTx {
  caip2: string; hash: string; summary: string;
  status: 'pending' | 'confirmed'; success?: boolean;
}
interface TxState {
  byHash: Record<string, TrackedTx>;
  addPending(tx: { caip2: string; hash: string; summary: string }): void;
  setConfirmed(hash: string, success: boolean): void;
}

export const useTxStore = create<TxState>((set) => ({
  byHash: {},
  addPending: (tx) => set((s) => ({ byHash: { ...s.byHash, [tx.hash]: { ...tx, status: 'pending' } } })),
  setConfirmed: (hash, success) => set((s) => {
    const prev = s.byHash[hash];
    if (!prev) return s;
    return { byHash: { ...s.byHash, [hash]: { ...prev, status: 'confirmed', success } } };
  }),
}));
```

- [ ] **Step 4: Run — verify PASS; tsc clean.**

- [ ] **Step 5: Commit** `git add src/state/stores/WalletStore.* src/state/stores/TxStore.* && git commit -m "feat(state): add WalletStore + TxStore (zustand)"`

---

## Task 4: KeyringService + BalanceService

**Files:** Create `src/state/services/KeyringService.ts`, `src/state/services/BalanceService.ts`; Test each (mock deps per §8)

- [ ] **Step 1: Write failing tests**

```typescript
// src/state/services/KeyringService.test.ts
import SecureKeyring from '../../native-bridge/NativeSecureKeyring';
import { bus } from '../bus/eventBus';
import { KeyringService } from './KeyringService';

describe('KeyringService', () => {
  it('imports a mnemonic via the bridge and emits wallet/added', async () => {
    (SecureKeyring.importMnemonic as jest.Mock).mockResolvedValue('ref-9');
    const emitted: any[] = [];
    bus.on('wallet/added', (p) => emitted.push(p));
    const svc = new KeyringService();
    const ref = await svc.importMnemonic('abandon ... about');
    expect(ref).toBe('ref-9');
    expect(SecureKeyring.importMnemonic).toHaveBeenCalledWith('abandon ... about');
    expect(emitted).toEqual([{ walletRef: 'ref-9' }]);
    bus.off('wallet/added');
  });
});
```

```typescript
// src/state/services/BalanceService.test.ts
import { useAssetsStore } from '../stores/AssetsStore';
import { BalanceService } from './BalanceService';

describe('BalanceService', () => {
  beforeEach(() => useAssetsStore.setState({ nativeBalance: {} }));
  it('reads via the injected adapter factory and writes AssetsStore', async () => {
    const adapter = { getNativeBalance: jest.fn(async () => 42n) } as any;
    const svc = new BalanceService(() => adapter); // inject adapter factory (DI)
    await svc.refreshNative('eip155:1', '0xabc');
    expect(adapter.getNativeBalance).toHaveBeenCalledWith('0xabc');
    expect(useAssetsStore.getState().nativeBalance['eip155:1:0xabc']).toBe(42n);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement** (stateless; dependencies injected)

```typescript
// src/state/services/KeyringService.ts
import SecureKeyring from '../../native-bridge/NativeSecureKeyring';
import { bus } from '../bus/eventBus';

// The ONLY orchestration wrapper around the native bridge for wallet lifecycle/derivation.
// Signing is NOT here — it stays in chain-adapter → SecureKeyring.signHash.
export class KeyringService {
  async importMnemonic(mnemonic: string): Promise<string> {
    const walletRef = await SecureKeyring.importMnemonic(mnemonic);
    bus.emit('wallet/added', { walletRef });
    return walletRef;
  }
  deriveAddress(walletRef: string, coinType: number): Promise<string> {
    return SecureKeyring.deriveAddress(walletRef, coinType);
  }
  deleteWallet(walletRef: string): Promise<boolean> {
    return SecureKeyring.deleteWallet(walletRef);
  }
}
```

```typescript
// src/state/services/BalanceService.ts
import { getChain } from '../../chain-registry/chains';
import { getAdapter } from '../../chain-adapter/getAdapter';
import type { ReadOnlyChainAdapter } from '../../chain-adapter/types';
import { useAssetsStore } from '../stores/AssetsStore';

// Stateless: reads via adapter, writes AssetsStore. Adapter factory is injected for testability.
export class BalanceService {
  constructor(private adapterFor: (caip2: string) => ReadOnlyChainAdapter =
    (caip2) => getAdapter(getChain(caip2)!)) {}

  async refreshNative(caip2: string, address: string): Promise<void> {
    const bal = await this.adapterFor(caip2).getNativeBalance(address);
    useAssetsStore.getState().setNativeBalance(caip2, address, bal);
  }
}
```

- [ ] **Step 4: Run — verify PASS; tsc clean.** (`getAdapter` takes a `ChainConfig`; the default factory resolves it via `getChain`.)

- [ ] **Step 5: Commit** `git add src/state/services/KeyringService.* src/state/services/BalanceService.* && git commit -m "feat(state): add KeyringService + BalanceService (stateless, DI)"`

---

## Task 5: BroadcastService + TxStatusService

**Files:** Create `src/state/services/BroadcastService.ts`, `src/state/services/TxStatusService.ts`; Test each

- [ ] **Step 1: Write failing tests**

```typescript
// src/state/services/BroadcastService.test.ts
import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';
import { BroadcastService } from './BroadcastService';

describe('BroadcastService', () => {
  beforeEach(() => useTxStore.setState({ byHash: {} }));
  it('broadcasts via injected fn, records pending tx, emits tx/submitted', async () => {
    const emitted: any[] = [];
    bus.on('tx/submitted', (p) => emitted.push(p));
    const svc = new BroadcastService(async () => '0xhash');
    const hash = await svc.send('eip155:1', '0xsignedraw', 'send 1 ETH');
    expect(hash).toBe('0xhash');
    expect(useTxStore.getState().byHash['0xhash'].status).toBe('pending');
    expect(emitted).toEqual([{ caip2: 'eip155:1', hash: '0xhash' }]);
    bus.off('tx/submitted');
  });
});
```

```typescript
// src/state/services/TxStatusService.test.ts
import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';
import { TxStatusService } from './TxStatusService';

describe('TxStatusService', () => {
  beforeEach(() => useTxStore.setState({ byHash: { '0xh': { caip2: 'eip155:1', hash: '0xh', summary: 's', status: 'pending' } } }));
  it('marks confirmed and emits tx/confirmed when the poller reports success', async () => {
    const emitted: any[] = [];
    bus.on('tx/confirmed', (p) => emitted.push(p));
    const svc = new TxStatusService(async () => ({ confirmed: true, success: true })); // inject poll fn
    await svc.track('eip155:1', '0xh');
    expect(useTxStore.getState().byHash['0xh'].status).toBe('confirmed');
    expect(emitted).toEqual([{ caip2: 'eip155:1', hash: '0xh', success: true }]);
    bus.off('tx/confirmed');
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/state/services/BroadcastService.ts
import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';

// Broadcast fn is injected (default wires to the signing adapter at container time).
export class BroadcastService {
  constructor(private broadcastFn: (caip2: string, signedRawTx: string) => Promise<string>) {}
  async send(caip2: string, signedRawTx: string, summary: string): Promise<string> {
    const hash = await this.broadcastFn(caip2, signedRawTx);
    useTxStore.getState().addPending({ caip2, hash, summary });
    bus.emit('tx/submitted', { caip2, hash });
    return hash;
  }
}
```

```typescript
// src/state/services/TxStatusService.ts
import { bus } from '../bus/eventBus';
import { useTxStore } from '../stores/TxStore';

export interface PollResult { confirmed: boolean; success: boolean; }
// Poll fn injected (default: per-chain receipt lookup at container time).
export class TxStatusService {
  constructor(private pollOnce: (caip2: string, hash: string) => Promise<PollResult>) {}
  async track(caip2: string, hash: string): Promise<void> {
    const r = await this.pollOnce(caip2, hash);
    if (r.confirmed) {
      useTxStore.getState().setConfirmed(hash, r.success);
      bus.emit('tx/confirmed', { caip2, hash, success: r.success });
    }
  }
}
```
(A real polling loop with retries/backoff is a follow-up; `track` here does one poll cycle — the container can schedule repeats. Keep it injectable + testable.)

- [ ] **Step 4: Run — verify PASS; tsc clean.**

- [ ] **Step 5: Commit** `git add src/state/services/BroadcastService.* src/state/services/TxStatusService.* && git commit -m "feat(state): add BroadcastService + TxStatusService (stateless, DI, bus events)"`

---

## Task 6: container.ts (DI assembly + cross-domain wiring)

**Files:** Create `src/state/container.ts`; Test `src/state/container.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/state/container.test.ts
import { createContainer } from './container';
import { bus } from './bus/eventBus';
import { useTxStore } from './stores/TxStore';

describe('createContainer', () => {
  it('constructs services and wires tx/submitted -> TxStatusService.track', async () => {
    const c = createContainer({
      broadcastFn: async () => '0xhash',
      pollOnce: async () => ({ confirmed: true, success: true }),
    });
    expect(c.keyring).toBeDefined();
    expect(c.balance).toBeDefined();
    // Emitting tx/submitted should trigger tracking → eventual confirmed in TxStore.
    useTxStore.setState({ byHash: { '0xhash': { caip2: 'eip155:1', hash: '0xhash', summary: 's', status: 'pending' } } });
    bus.emit('tx/submitted', { caip2: 'eip155:1', hash: '0xhash' });
    await new Promise((r) => setTimeout(r, 0)); // let the async handler run
    expect(useTxStore.getState().byHash['0xhash'].status).toBe('confirmed');
  });
});
```

- [ ] **Step 2: Run — verify FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/state/container.ts
import { KeyringService } from './services/KeyringService';
import { BalanceService } from './services/BalanceService';
import { BroadcastService } from './services/BroadcastService';
import { TxStatusService, PollResult } from './services/TxStatusService';
import { bus } from './bus/eventBus';

export interface ContainerDeps {
  broadcastFn?: (caip2: string, signedRawTx: string) => Promise<string>;
  pollOnce?: (caip2: string, hash: string) => Promise<PollResult>;
}

// DI assembly (≈Engine init): construct stateless services, inject deps, wire cross-domain
// bus subscriptions. Defaults wire to real adapters; tests inject fakes.
export function createContainer(deps: ContainerDeps = {}) {
  const keyring = new KeyringService();
  const balance = new BalanceService();
  const broadcast = new BroadcastService(
    deps.broadcastFn ?? (async (caip2, raw) => {
      const { getSigningAdapter } = await import('../chain-adapter/EvmSigningAdapter');
      const { getChain } = await import('../chain-registry/chains');
      return getSigningAdapter(getChain(caip2)!).broadcast(raw);
    }),
  );
  const txStatus = new TxStatusService(
    deps.pollOnce ?? (async () => ({ confirmed: false, success: false })), // real per-chain receipt poll = follow-up
  );

  // Cross-domain wiring: after a tx is submitted, start tracking its confirmation.
  bus.on('tx/submitted', ({ caip2, hash }) => { void txStatus.track(caip2, hash); });

  return { keyring, balance, broadcast, txStatus };
}
```
NOTE: keep the default `pollOnce` a safe no-op (confirmed:false) until a real per-chain receipt poller is implemented (follow-up) — do NOT fake confirmations in production. The test injects a confirming poll.

- [ ] **Step 4: Run — verify PASS; tsc clean.**

- [ ] **Step 5: Commit** `git add src/state/container.* && git commit -m "feat(state): add DI container + cross-domain bus wiring"`

---

## Task 7: On-device boot check (zustand/mitt in Hermes) + docs

**Files:** Modify `src/devtools/` + `App.tsx` (light probe); update `docs/state-layer-design.md` (mark foundation built)

- [ ] **Step 1: Add a `STATELAYER` device probe** — a small self-test that: creates the container, imports the golden mnemonic via `KeyringService` (asserts `wallet/added` fires + a walletRef returns), builds the account tree, calls `BalanceService.refreshNative` for one chain (real RPC), asserts `AssetsStore` got a `>= 0n` entry, and a bus round-trip (emit `tx/submitted` → handler ran). Log `STATELAYER_*` sentinels (RESULT from every line ok). Wire into `App.tsx` auto-run.

- [ ] **Step 2: Both-platform run** — confirm `STATELAYER_RESULT=ALL_PASS` on iOS + Android (proves zustand + mitt load + run in Hermes and the store/service/bus round-trip works on-device). Capture lines. Also confirm the existing SELFTEST/READONLY/EVMSIGN/TRONSIGN still ALL_PASS (no regression from the new deps).

- [ ] **Step 3: Update `docs/state-layer-design.md`** — add a short "Status (2026-06-09): foundation built" note listing the implemented stores/services/bus/container and the deferred items (SettingsStore, DappStore, PriceService, DappRequestService, NodeService, real TxStatus polling loop), per the doc's §7 introduction order.

- [ ] **Step 4: Commit** `git add src/devtools/ App.tsx docs/state-layer-design.md && git commit -m "test(state): on-device state-layer round-trip (zustand/mitt in Hermes) + status doc"`

---

## Self-Review

**Spec coverage (state-layer-design.md):** Store/Service/EventBus/container roles (Tasks 1–6); three iron rules — UI-via-selectors (stores expose hooks; no service holds state), stateless services (all four take deps via constructor, hold no business state), single ownership (each store owns its slice; cross-domain only via bus — `tx/submitted`→TxStatus wired in container) ✅. §8 test strategy (stores pure, services mocked-deps, bus emit→subscriber) ✅. §7 YAGNI order (bus+stores+services+container now; Settings/Dapp/Price/Node + real polling deferred) ✅. Reference: MetaMask Controller/Service/Messenger discipline.

**Key-safety:** services never touch crypto/keys — `KeyringService` wraps bridge lifecycle/derivation only; signing stays in chain-adapter. ✅

**No placeholders:** real code per step; the only intentional no-op is the default `pollOnce` (safe `confirmed:false` until a real receipt poller lands — documented, not faked). ✅

**Type consistency:** `AppEvents` (Task 1) consumed by all services + container; `ChainAccount` (from `multichain/accountTree`) used by `WalletStore`; `ReadOnlyChainAdapter` injected into `BalanceService`; `PollResult` shared by `TxStatusService` + container; store hooks (`useNetworkStore`/`useAssetsStore`/`useWalletStore`/`useTxStore`) are the single owners of their slices; `getSigningAdapter`/`getChain`/`getAdapter` reused from existing layers. No store imports a service; no service imports another service (cross-domain via `bus`) — single-ownership/no-cycles preserved.

# Phase 1 — Read-Only Multichain Exit Gate

> Status: **PASSED.**
> Date: 2026-06-07 · Branch: `phase1-readonly-multichain`
> Plan: [`docs/superpowers/plans/2026-06-07-tronlink-rn-phase1-readonly-multichain.md`](superpowers/plans/2026-06-07-tronlink-rn-phase1-readonly-multichain.md)
> Builds on: [`docs/phase0-foundation.md`](phase0-foundation.md)

Phase 1「地基」delivers the config-driven, **read-only** multichain layer on top of the proven Phase-0 `SecureKeyring` bridge: a CAIP-2 chain registry, a unified read-only `ChainAdapter` with family reuse, a failover network layer, and a cross-chain account tree — with **zero funds at risk** (no signing, no broadcasting).

## 1. What Phase 1 delivers

| Layer | File(s) | Responsibility |
| --- | --- | --- |
| Chain registry | `src/chain-registry/{types,chains}.ts` | `ChainConfig[]` (CAIP-2, coinType, family, rpc, capabilities) + `getChain` / `chainsByFamily` |
| Network | `src/net/{http,jsonRpc}.ts` | `withFailover` (primary→fallback) + EVM JSON-RPC client |
| ABI | `src/chain-adapter/abi.ts` | hand-coded ERC-20 `balanceOf` encode + uint256 decode (no heavy deps) |
| Adapter contract | `src/chain-adapter/types.ts` | `ReadOnlyChainAdapter` + `TokenRef` |
| Adapters | `src/chain-adapter/{EvmAdapter,TronAdapter}.ts` | per-family read: derive / validate / native + token balance |
| Factory | `src/chain-adapter/getAdapter.ts` | `ChainConfig.family` → adapter |
| Account tree | `src/multichain/accountTree.ts` | derive an address per chain (one derivation per coinType; EVM chains share `m/44'/60'`) |
| Device capstone | `src/devtools/ReadOnlySelfTest.ts`, `App.tsx` | on-device address-parity + live-balance self-test |

**Supported chains:** TRON (`tron:728126428`), Ethereum (`eip155:1`), BNB Smart Chain (`eip155:56`).

## 2. Architecture invariants proven

- **Config-driven extensibility.** Adding an EVM chain = one row in `CHAINS` (it reuses `EvmAdapter` and the single `m/44'/60'` address — verified: ETH and BSC resolve to the same address). Adding a new family = one new adapter (selected by `getAdapter`).
- **Read-only by construction (zero funds at risk).** `ReadOnlyChainAdapter` exposes only `deriveAddress` / `validateAddress` / `getNativeBalance` / `getTokenBalance`. No `buildTransaction` / `sign` / `broadcast` exists yet — deferred to Phase 2/3.
- **Private key stays native.** Derivation/validation go through the Phase-0 `SecureKeyring` bridge (coinType 60 EVM / 195 TRON); the RN layer only assembles HTTPS reads.
- **Resilient transport.** All reads go through `withFailover` (primary then fallbacks), over HTTPS (EVM JSON-RPC / TronGrid REST).

## 3. Exit criteria & evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | All Jest suites pass | **9 suites / 30 tests** pass (`yarn jest --watchman=false`): chains, http/jsonRpc, abi, adapter types, EvmAdapter, TronAdapter, accountTree, plus Phase-0 App + goldenVectors. |
| 2 | TypeScript clean | `yarn tsc --noEmit` clean. |
| 3 | On-device read-only self-test ALL_PASS on both platforms | `READONLY_RESULT=ALL_PASS` captured on iOS (iPhone 17 Pro, via Metro `--client-logs`) and Android (Pixel 10, via `adb logcat`). Derive lines match golden addresses (EVM `0x9858…aEda94`, TRON `TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH`); live native-balance reads resolved (0 for the unfunded golden mnemonic — endpoints reachable). Commit `3715d65`. |

Captured capstone output (both platforms):
```
READONLY_LINE PASS derive TRON | TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH
READONLY_LINE PASS derive Ethereum | 0x9858EfFD232B4033E47d90003D41EC34EcaEda94
READONLY_LINE PASS derive BNB Smart Chain | 0x9858EfFD232B4033E47d90003D41EC34EcaEda94
READONLY_LINE PASS balance TRON | 0 TRX
READONLY_LINE PASS balance Ethereum | 0 ETH
READONLY_LINE PASS balance BNB Smart Chain | 0 BNB
READONLY_RESULT=ALL_PASS
```

## 4. How to add a chain

- **Another EVM chain (e.g. Polygon):** add one row to `CHAINS` in `src/chain-registry/chains.ts` with `family:'evm'`, `coinType:60`, its `rpc`/`explorerTx`/`capabilities`. No code change — `EvmAdapter` + the shared address handle it.
- **A new family (e.g. Solana):** add a `SolanaAdapter implements ReadOnlyChainAdapter`, a `case` in `getAdapter`, and confirm the native key core (TWCore) supports the coinType.

## 5. Known debt / follow-ups

- **Public RPC endpoints.** `rpc.primary` uses public nodes (Ethereum primary is `https://ethereum.publicnode.com` after `eth.llamarpc.com`/`cloudflare-eth.com` returned `-32603` and `rpc.ankr.com/eth` required a key). Replace with the self-operated TronLink gateway before production (architecture D6).
- **Multicall batching** (architecture §4.3) deferred to Phase 1.5 — Phase 1 reads balances with individual `eth_call` / TronGrid account lookups.
- **`jest.config.js` `forceExit: true`** was added so the auto-running on-mount self-test (live async calls during the App render test) doesn't keep Jest's worker alive after teardown. Revisit with `--detectOpenHandles` if the test suite grows.
- Carried from Phase 0: §7 human cross-check of the golden TRON address vs the real TronLink wallet; Gradle dependency verification; metro `useWatchman` CI-scoping; PAT rotation.

## 6. Commit log (Phase 1)

```
3715d65 test: on-device read-only multichain self-test (address parity + live balances)
3ffc08b feat: add adapter factory and cross-chain account tree
155f0df feat: add read-only TronAdapter (derive + TRX/TRC20 balance)
5793f60 feat: add read-only EvmAdapter (derive + native/token balance)
41dbeea feat: define read-only ChainAdapter interface and TokenRef
36446c1 feat: add hand-coded ERC-20 balanceOf ABI helpers
78551d9 feat: add failover HTTP + JSON-RPC client
f867602 feat: add config-driven CAIP-2 chain registry (TRON, ETH, BSC)
```

## 7. Handoff → Phase 2 (EVM full path)

Read works; next is the write path for EVM. Phase 2 introduces `SigningChainAdapter extends ReadOnlyChainAdapter` adding `buildTransaction` (nonce/gas/EIP-1559) → `sign` via the bridge (`AnySigner.signJson(coin=ethereum)` in native) → `broadcast` (`eth_sendRawTransaction` over the failover client), plus the EVM WebView provider. TRON's write path (with the §5 dual-signing fallback) follows in Phase 3. See the implementation architecture doc for the signing contract.

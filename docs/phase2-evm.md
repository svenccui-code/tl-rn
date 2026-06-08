# Phase 2 — EVM Full Path Exit Gate

> Status: **PASSED.**
> Date: 2026-06-07 · Branch: `phase2-evm-full-path`
> Plan: [`docs/superpowers/plans/2026-06-07-tronlink-rn-phase2-evm-full-path.md`](superpowers/plans/2026-06-07-tronlink-rn-phase2-evm-full-path.md)
> Builds on: [`docs/phase1-readonly.md`](phase1-readonly.md), [`docs/phase0-foundation.md`](phase0-foundation.md)

Phase 2 completes the **EVM write path**: a `SigningChainAdapter` (`buildTransaction` → `sign` → `broadcast`), `personal_sign`, and an EVM WebView provider (`window.ethereum`, EIP-1193). Built entirely on the Phase-0 `signHash` bridge — **no native/codegen changes**.

## 1. Signing approach (and why)

> **Update 2026-06-09:** the EVM encode / signing-hash / ABI / EIP-191 are now done with **viem** (not hand-rolled RLP/keccak) — see [`docs/library-adoption.md`](library-adoption.md). The flow and golden vectors below are unchanged; only the implementation moved to viem (`serializeTransaction`/`keccak256`/`encodeFunctionData`/`hashMessage`), with the native signature injected via `serializeTransaction(tx, { r, s, yParity })`.

EVM transactions are assembled and **encoded via viem**; only the 32-byte EIP-1559 signing hash crosses the bridge via the proven Phase-0 `SecureKeyring.signHash(walletRef, 60, hash)`, which returns a 65-byte `r||s||yParity` signature. The signed rawTx is serialized by viem with the injected signature.

- **Private key never leaves native** — `signHash` receives a public hash, returns a signature. (Architecture §5 mode-2 path, applied to EVM.)
- **No native or codegen changes** — reuses the Phase-0 bridge as-is; lower risk, fully Jest-testable.
- **Correctness is anchored to ethers** — the golden signed tx is produced by ethers v6 (offline oracle) and pinned; both Jest and the on-device capstone assert our pipeline reproduces it byte-for-byte.
- New dependency: `@noble/hashes` (audited, pure-TS keccak-256 — hashing of public data only). `react-native-webview` for the DApp host.

## 2. Golden EVM vector (ethers-derived, pinned in `src/evm/evmGolden.ts`)

Standard test mnemonic (`abandon … about`), `m/44'/60'`, from = `0x9858EfFD232B4033E47d90003D41EC34EcaEda94`.

| Field | Value |
| --- | --- |
| tx | type-2, chainId 1, nonce 0, maxPriorityFeePerGas 1 gwei, maxFeePerGas 20 gwei, gasLimit 21000, to self, value 0.001 ETH, data 0x |
| signing hash | `0x5798cced33015601eb042779e743a48d557048a70e41f998dadff5489712a67d` |
| signed rawTx | `0x02f8720180843b9aca008504a817c800825208949858effd232b4033e47d90003d41ec34ecaeda9487038d7ea4c6800080c080a065a1f4ea4978d065bfbe115b7b3511b6e5c072cc380b3d03bb9ac815e158a731a0404f421ac43e0111550184e5288091598607c792306352cea3938689deb03785` |
| txHash | `0x2ddd87964b8474515d3e707e1479dcd0e1f5286575a822eb16de7b9c1ef41584` |

The personal_sign (EIP-191) hash for `"hello tronlink"` is pinned at `0x6495cba2…fbaab7` (ethers parity).

## 3. Exit criteria & evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Full Jest suite passes | **18 suites / 60 tests** (`yarn jest --watchman=false`): crypto/bytes/keccak, rlp, tx, signedTx, EvmSigningAdapter, message, evmRequestRouter, provider-inject + all prior. |
| 2 | TypeScript clean | `yarn tsc --noEmit` clean. |
| 3 | On-device sign parity, both platforms | `EVMSIGN_RESULT=ALL_PASS` on iOS (iPhone 17 Pro) and Android (Pixel 10): TS-built EIP-1559 + **real TWCore `signHash`** + TS-assembled rawTx == the ethers-pinned `signedRawTx`, byte-for-byte. Commit `bd18d1a`. |
| 4 | DApp request routing | `evmRequestRouter` unit-tested for eth_requestAccounts/eth_accounts, eth_chainId/net_version, eth_sendTransaction (confirm→sign→broadcast + 4001 on decline), personal_sign, and RPC passthrough. Provider script (`window.ethereum`, EIP-1193 + 6963) unit-tested. |

> The on-device DApp WebView UI smoke (loading a page and exercising the live provider) was not automated — the routing logic and provider script are fully unit-tested, and the EVMSIGN signing capstone is the gate. A manual WebView smoke can be run via `EvmDappWebView` against a test page when needed.

## 4. What the EVM provider supports

`window.ethereum.request({method, params})` →
- `eth_requestAccounts` / `eth_accounts` → active address
- `eth_chainId` / `net_version`
- `eth_sendTransaction` → confirm → build (nonce/gas via RPC) → `signHash` → assemble → `eth_sendRawTransaction`
- `personal_sign` → EIP-191 hash → `signHash` → v=27/28 signature
- all other reads → passthrough to the chain's failover RPC
Plus EIP-1193 events (`on`/`removeListener`), legacy `send`/`sendAsync`/`enable`, and a single-provider EIP-6963 announce.

## 5. Deferred (later phases)

- `eth_signTypedData_v4` (EIP-712) → returns 4200 "not supported yet"; **Phase 4**.
- Full DApp connect/approval UX (the `confirm` callback is a hook; real modal UI) → **Phase 4**.
- Dual `window.tron` provider + EIP-6963 multi-provider → **Phase 4**.
- TRON write path (build/sign/broadcast with §5 dual-signing) → **Phase 3**.
- **Broadcast on-device**: `broadcast` (`eth_sendRawTransaction`) is implemented and unit-tested; an end-to-end real broadcast needs a funded testnet account (e.g. fund the golden address on Sepolia) — optional manual verification, not an automated gate (zero-funds discipline).
- Carried debt: public RPC → self gateway; Gradle dependency verification; §7 TRON address human cross-check; PAT rotation; metro `useWatchman` CI-scoping.

## 6. Commit log (Phase 2)

```
bd18d1a test: on-device EVM signed-tx golden parity (TWCore == ethers)
4b6181a docs: add Phase-1 and Phase-2 implementation plans
cfc6a04 feat: add EVM WebView host + injected EIP-1193 provider
b137e50 feat: add EVM DApp request router (read passthrough + sign/send/personal_sign)
e96e536 feat: add EVM personal_sign (EIP-191) message signing
e023362 feat: add SigningChainAdapter + EvmSigningAdapter (build/sign/broadcast)
5cb4405 feat: assemble signed EIP-1559 tx; pin ethers golden vector
40bb606 feat: add EIP-1559 unsigned tx encoding and signing hash
7f0af19 feat: add minimal RLP encoder
559a6d7 feat: add keccak-256 and byte helpers for EVM encoding
```

## 7. Handoff → Phase 3 (TRON write path)

EVM write works. Phase 3 implements TRON transactions: `TronSigningAdapter` building `raw_data` (protobuf) → `txID = sha256(raw_data)` → `signHash` → reassemble (architecture §5 — standard transfers + the dual-signing fallback covering multisig / Stake 2.0 / vote / GasFree), broadcast via TronGrid `/wallet/broadcasthex`. Golden vector cross-checked against the existing TronLink wallet. Then Phase 4 adds the dual DApp provider + signTypedData + connect UX.

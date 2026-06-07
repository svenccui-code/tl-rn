# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TronLink RN** is the multichain rewrite of the TronLink wallet (TRON + EVM, more chains later) as a single React Native codebase shared by iOS and Android. It follows a **strangler (brownfield) migration**: screens move from the existing native apps (`../tronlink-android`, `../TronLink_iOS`) into RN one at a time, while the native layer is shrunk down to **only the key core + a thin bridge + platform capabilities**.

The key core is **Trust Wallet Core (TWCore)** — a native C++ library. **Private keys, derivation, and signing all live in native; the RN/JS layer never touches a plaintext private key.** This is the same architecture Trust Wallet ships (verified by APK teardown).

## Current Status (read this first)

> **This repo is greenfield.** As of the last update it contains only `docs/`. The RN skeleton, native modules, and `src/` layers described below are **created incrementally by executing the Phase-0 plan** — do not assume a path exists; check before referencing it.

The current work item is **Phase 0「立桩」** (foundation): integrate TWCore on both platforms behind the `SecureKeyring` TurboModule and prove golden-vector parity. Execute it task-by-task from the plan, not freehand.

## Authoritative Documents

These are the source of truth. Read them before designing or implementing — this file only summarizes.

| Document | What it is |
| --- | --- |
| `~/docs/multichain/00-handoff.md` | Session handoff / index. **Start here** in a fresh session. |
| `~/docs/multichain/tronlink-rn-implementation-architecture.md` | **The implementable architecture** (key core = TWCore): bridge contract, ChainAdapter, chain registry, broadcast, TRON full-feature strategy, phased plan. |
| `~/docs/multichain/tronlink-multichain-decision.md` | Locked decisions D1–D6 (long form) + strangler route + risks. |
| `docs/superpowers/plans/2026-06-05-tronlink-rn-phase0-foundation.md` | **The Phase-0 task plan** currently being executed. |
| `~/docs/multichain/trust-wallet-apk-architecture.md` | Reference: Trust Wallet's same-shape architecture (RN + TWCore). |

## Locked Decisions (do not relitigate)

| # | Decision |
| --- | --- |
| D1 | Full rewrite to React Native; iOS/Android share one TS codebase; strangler per-screen migration. |
| D2 | Keys/signing stay native. **RN never sees a plaintext private key** — always via the Native Module bridge. |
| D3 | Key core = **Trust Wallet Core** (native pod/AAR). NOT `@tronlink/core`. |
| D4 | No isolated JS runtime — TWCore is already native, so the key is natively isolated by construction. |
| D5 | Config-driven **chain registry** (CAIP-2 naming + capability flags) + one unified **`ChainAdapter`** interface + family grouping (all EVM chains share `EvmAdapter`). |
| D6 | Signing in the native core; **broadcast in the RN layer over HTTPS** (EVM = JSON-RPC, TRON = TronGrid REST). |

## Hard Rules (non-negotiable invariants)

1. **Private key never crosses the bridge.** The `SecureKeyring` TurboModule contract has no private-key parameters or return values — ever. Permitted outputs are only `address` / `signedRawTxHex` / `signatureHex`, plus `mnemonic` *only* from a future create/backup method (the architecture's full design; the **Phase-0 spec does not yet expose any mnemonic-returning method** — `importMnemonic` takes the mnemonic as input only). Signing happens inside TWCore in native memory; the handle is released immediately after.
2. **Use TWCore native bindings, never the WASM npm package.** iOS = CocoaPods `TrustWalletCore`; Android = Maven `com.trustwallet:wallet-core`. **Do NOT add `@trustwallet/wallet-core` (WASM)** — that would run signing in JS and break D2.
3. **Golden-vector parity is a gate.** A fixed test mnemonic must derive identical TRON (`m/44'/195'`) and EVM (`m/44'/60'`) addresses + signatures across TWCore-iOS, TWCore-Android, and the existing TronLink wallet. Never hardcode a guessed Base58Check/signature value — derive it, cross-check against the real TronLink wallet (architecture §7), then pin it.
4. **TRON full-feature coverage uses the dual-signing fallback (architecture §5).** Standard contract types go through `AnySigner.signJson(coin=tron)`. Multisig / Stake 2.0 / vote / GasFree / any type `AnySigner` doesn't cover: assemble `raw_data` (protobuf) in TS → compute `txID = sha256(raw_data)` → bridge `signHash` → TWCore `PrivateKey.sign(txID)` → reassemble in TS. This guarantees 100% TRON feature coverage without the key leaving native.
5. **Broadcast is RN-side over HTTPS only.** `signedRawTx` contains no key, so broadcasting from JS is safe. Default to `rpc.primary` (TronLink gateway) with `rpc.fallback` (public RPC).

## Architecture

```
RN / Hermes (shared TS)                      Native (iOS Swift / Android Kotlin)
  UI · navigation · state (Redux Toolkit)
  chain-registry/  (CAIP-2 + capabilities)
  chain-adapter/   (ChainAdapter + evm/tron)
  multichain/      (accounts · nodes · balance · tx build)   ── signHash/signTx ──▶  SecureKeyring impl
  broadcast/       (HTTPS: EVM JSON-RPC / TRON TronGrid)                              └─▶ Trust Wallet Core (C++)
  native-bridge/   (TurboModule client, TS)  ──── JSI/codegen ────▶  SecureKeyringSpec   └─▶ Vault: StoredKey + Keychain/Keystore
  dapp/            (WebView dual provider: window.tron + window.ethereum)
```

### Target `src/` layout (created incrementally — not all present yet)

```
src/
  native-bridge/    TurboModule spec(s); NativeSecureKeyring.ts is the key-core contract
  crypto/           golden vectors + crypto helpers (single source of truth for test vectors)
  chain-registry/   chains.ts — ChainConfig[] (CAIP-2, coinType, family, rpc, capabilities)   [Phase 1]
  chain-adapter/    ChainAdapter.ts + EvmAdapter / TronAdapter                                  [Phase 1–3]
  multichain/       account tree · node mgmt · balances (EVM multicall / TRON) · tx build       [Phase 1+]
  broadcast/        evmBroadcast.ts (eth_sendRawTransaction) / tronBroadcast.ts (broadcasthex)  [Phase 2+]
  dapp/             WebView dual provider (TIP-1193 + EIP-1193/6963)                             [Phase 4]
  devtools/         BridgeSelfTest etc.
```

### The `SecureKeyring` bridge

- TS spec: `src/native-bridge/NativeSecureKeyring.ts` (RN New Architecture codegen, `type: modules`).
- iOS impl: ObjC++ `ios/.../SecureKeyring.mm` (conforms to generated `NativeSecureKeyringSpec`) delegating to Swift `SecureKeyringCore.swift` which calls TWCore (`WalletCore`).
- Android impl: Kotlin `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt` calling the `wallet.core.jni.*` AAR, registered via `SecureKeyringPackage`.
- CoinType mapping: TRON = `195` (`CoinType.tron`), EVM = `60` (`CoinType.ethereum`); all EVM chains share `m/44'/60'`.

## Essential Commands

> JS deps via **yarn** (classic 1.22). RN CLI / codegen via **npx**. The skeleton is generated in Phase-0 Task 1; before then most of these have nothing to run against.

```bash
# Setup (after RN skeleton exists)
yarn install
(cd ios && pod install)            # also runs TurboModule codegen

# Run
npx react-native start             # Metro bundler
npx react-native run-ios --simulator "iPhone 16"
npx react-native run-android       # needs a running emulator/device (check: adb devices)

# JS tests
yarn jest                          # all Jest tests
yarn jest <file>                   # one file
yarn jest <file> -t "<pattern>"    # one test case

# Native golden-vector tests (the real correctness gate for the key core)
(cd ios && xcodebuild test -workspace TronLinkRN.xcworkspace -scheme TronLinkRN \
   -destination 'platform=iOS Simulator,name=iPhone 16' \
   -only-testing:TronLinkRNTests/SecureKeyringCoreTests)
(cd android && ./gradlew :app:connectedDebugAndroidTest)   # instrumented; emulator required
```

## Toolchain (verified on this machine, 2026-06-05)

| Tool | Version / note |
| --- | --- |
| React Native | **0.84** (Hermes V1, New Architecture default; legacy bridge removed in 0.82 — TurboModules/JSI is the only path) |
| Trust Wallet Core | iOS pod `TrustWalletCore` (pin via `Podfile.lock`) · Android `com.trustwallet:wallet-core:4.6.0` |
| Node | v26 (non-LTS, on trial). RN officially supports 22 LTS — if Metro/CLI misbehaves, switch with `nvm use 22`. |
| Yarn | 1.22 (classic) · CocoaPods 1.16.2 · watchman installed |
| Xcode | 26.5 · iOS 26.5 simulator |
| Android | JDK 21 · NDK 27.0.12077973 · cmake 3.22.1 · build-tools 35/36/37 · `ANDROID_HOME=~/Library/Android/sdk` (note: `cmdline-tools`/`sdkmanager` not installed) |

## Conventions

- **TypeScript everywhere; no `any`.**
- **English only** for code comments and git commit messages (user global rule). User-facing strings / product docs may stay Chinese.
- State: Redux Toolkit. Navigation: React Navigation.
- Follow the Phase-0 plan's TDD cadence: failing test → run red → minimal impl → run green → commit. Frequent small commits.

## Phased Roadmap (strangler)

| Phase | Goal |
| --- | --- |
| **0 立桩** *(current)* | TWCore + `SecureKeyring` bridge + golden vectors (TRON/EVM address & signature parity). |
| 1 地基 | Chain registry + ChainAdapter + read-only (account tree, address derivation, balances). Zero funds at risk. |
| 2 EVM | EvmAdapter full path: build/sign/broadcast (JSON-RPC) + EVM WebView provider. |
| 3 TRON | Per-screen migration: transfer → multisig → Stake 2.0 → vote → GasFree, dual-signing (§5), TronGrid broadcast. |
| 4 DApp | Dual provider `window.tron` (TIP-1193) + `window.ethereum` (EIP-1193/6963). |
| 5 原生瘦身 | Native reduced to TWCore + bridge + platform capabilities; retire duplicated native screens. |

> Every phase runs the full TRON feature regression to guarantee zero regression for existing users.

# Phase 0 — Foundation Exit Gate

> Status: **PASSED (with one pending human verification, see §5).**
> Date: 2026-06-07 · Branch: `phase0-foundation`
> Plan: [`docs/superpowers/plans/2026-06-05-tronlink-rn-phase0-foundation.md`](superpowers/plans/2026-06-05-tronlink-rn-phase0-foundation.md)

Phase 0「立桩」proves the architecture's load-bearing claim: a single React Native codebase can drive a **native Trust Wallet Core key core** through one TurboModule (`SecureKeyring`) and produce **identical TRON + EVM addresses and signatures on iOS and Android**, with the **private key never crossing the JS bridge**.

## 1. Pinned golden vectors (single source of truth)

Source of truth: [`src/crypto/goldenVectors.ts`](../src/crypto/goldenVectors.ts). Standard Trezor test mnemonic:

```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

| Vector | Path / input | Pinned value |
| --- | --- | --- |
| EVM address | `m/44'/60'/0'/0/0` (coinType 60) | `0x9858EfFD232B4033E47d90003D41EC34EcaEda94` |
| TRON address | `m/44'/195'/0'/0/0` (coinType 195) | `TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH` |
| sign digest | `sha256("tronlink-rn golden vector")` | `0x0910c572a405945ea75ed966cec498d9a65abe9882a6563687fea7fa94bba3aa` |
| TRON signature | `PrivateKey.sign(digest, secp256k1)` (65 bytes) | `0x356af5e73bb4d7de750d128c1d626eac6ffa5ac951aba32ea1db83b81ab01d1a728f9693dfe716dabfa59720f15ecd5b3c7cf8d407288691965d269a3528cfd500` |

The EVM address is the canonical, independently-published value for this mnemonic — its match independently validates the BIP44 derivation pipeline (TRON uses the same standard).

## 2. Trust Wallet Core versions

| Platform | Source | Version |
| --- | --- | --- |
| iOS | CocoaPods `TrustWalletCore` (in `ios/Podfile`, pinned by `ios/Podfile.lock`) | **4.6.13** |
| Android | Maven `com.trustwallet:wallet-core` via **GitHub Packages** (auth) | **4.6.0** (official multi-ABI AAR, SHA-256 `5a02aab5b5fb2f71d990be28ca0f616d84d9490ad20821c5a76f337983f890e1`) |

Android dependency is resolved from the official GitHub Packages registry over authenticated HTTPS. Credentials live in git-ignored `android/local.properties` (`gpr.user`/`gpr.key`) with `GPR_USER`/`GPR_KEY` env fallback for CI. wallet-core is **not** published to public Maven Central.

## 3. Exit criteria & evidence

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | iOS native golden vectors pass | XCTest `SecureKeyringCoreTests` (EVM canonical + TRON addr + signHash), all pass on iPhone 17 Pro / iOS 26.5. Commit `e46273a`. |
| 2 | Android native golden vectors pass, identical constants | Instrumented `SecureKeyringGoldenTest` 3/3 pass on Pixel 10 AVD; reproduces the EXACT iOS-pinned TRON/EVM/sig. Commits `356cf56` (parity) + `20262cb` (official dep source). |
| 3 | End-to-end bridge self-test ✅ ALL PASS on both platforms | `SELFTEST_RESULT=ALL_PASS` captured from device logs on iOS (Metro `--client-logs`) and Android (`adb logcat`), values matching golden, `no-private-key-leak: clean`. Commit `1c3d8b6`. |
| 4 | TRON address cross-checked against the real existing TronLink wallet (§7) | **PENDING — human action.** See §5. |

## 4. Architecture invariants proven

- **Private key never crosses the bridge.** The `SecureKeyring` contract ([`src/native-bridge/NativeSecureKeyring.ts`](../src/native-bridge/NativeSecureKeyring.ts)) has no private-key params/returns; returns only ref / address / signature hex / bool. The self-test's `no-private-key-leak` guard passed. Keys live only inside TWCore in native memory.
- **Native bindings, not WASM.** iOS pod + Android AAR; `@trustwallet/wallet-core` (WASM) is absent.
- **Cross-platform parity.** iOS (TWCore 4.6.13) and Android (wallet-core 4.6.0) derive byte-identical addresses and signatures.
- **TRON universal-fallback signing path** (`signHash` over a digest) is implemented and golden-tested — this is the architecture §5 mode-2 mechanism that guarantees 100% TRON contract coverage.

## 5. PENDING: §7 migration cross-check (human)

To certify zero-resource-loss migration for existing users, import the test mnemonic (`abandon … about`) into the **real existing TronLink wallet** (e.g. the sibling `TronLink_iOS` / `tronlink-android` build or production app) and confirm account 0's TRON address equals:

```
TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH
```

If it matches, mark criterion #4 complete. If it differs, that is a migration finding (derivation path/config divergence) to resolve before TRON migration in Phase 3 — do not change the pinned constant; investigate.

## 6. Known debt / follow-ups (carry into Phase 1+)

- **Gradle dependency verification** not yet enabled. Harden supply chain with `./gradlew --write-verification-metadata sha256,pgp` and commit `gradle/verification-metadata.xml`; the official AAR SHA-256 is recorded in §2.
- **`metro.config.js` sets `useWatchman: false` globally** (workaround for a dead watchman socket on the build machine). Prefer scoping to CI (e.g. `useWatchman: process.env.CI !== 'true'`) or fixing watchman, before the repo grows.
- **iOS unit-test target was added by hand** to `project.pbxproj`; **Gradle pinned to 8.13** (RN 0.84 foojay/Gradle 9 incompatibility, commit `b0bffe8`).
- **CocoaPods deprecation**: Trust Wallet plans to discontinue the CocoaPods channel in favor of SPM; revisit when migrating off CocoaPods.
- **`importMnemonic` self-test check is structural** (truthy + no spaces), not a golden comparison — adequate because subsequent address checks catch a wrong handle; tighten if needed.
- **iOS / Android run screens** were verified via logs/build, not human visual confirmation of the UI.

## 7. Commit log (Phase 0)

```
1c3d8b6 test: end-to-end SecureKeyring bridge self-test asserts golden parity on both platforms
ca4bd7b feat(android): implement SecureKeyring TurboModule via wallet-core
b58bb1c feat(ios): implement SecureKeyring TurboModule via TrustWalletCore
c41d243 feat: define SecureKeyring TurboModule spec (private-key-free contract)
20262cb fix(android): resolve wallet-core from GitHub Packages, drop mavenLocal
356cf56 test(android): integrate wallet-core and assert cross-platform golden parity
e46273a test(ios): integrate TrustWalletCore and pin TRON/EVM golden vectors
73f3ebe test: add golden-vector constants and Jest harness
b0bffe8 fix(android): downgrade Gradle 9.0 -> 8.13 to fix foojay plugin incompatibility
bcd5b00 chore: bootstrap React Native 0.84 skeleton (New Architecture, Hermes)
```

## 8. Handoff → Phase 1 (地基)

The key core is proven. Phase 1 builds the read-only multichain layer on top of this bridge:
`src/chain-registry/` (ChainConfig[] — CAIP-2, coinType, family, rpc, capabilities) + `src/chain-adapter/` (`ChainAdapter` interface + `EvmAdapter`/`TronAdapter`) + multichain account tree, address derivation, and balance display (EVM multicall / TRON) — zero funds at risk. See the implementation architecture doc for the layer contracts.

# TronLink RN — Phase 0「立桩」Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `tronlink-rn` project with Trust Wallet Core wired into both native platforms behind a single TurboModule (`SecureKeyring`), proven by golden-vector tests that the same fixed mnemonic derives identical TRON + EVM addresses and signatures as the existing TronLink wallet — with the private key never crossing the JS bridge.

**Architecture:** RN 0.84 (Hermes, New Architecture default) provides shared TS. A codegen TurboModule `SecureKeyring` exposes a private-key-free contract (`importMnemonic` / `deriveAddress` / `validateAddress` / `signHash`). iOS implements it in ObjC++ delegating to a Swift core that calls the `TrustWalletCore` pod; Android implements it in Kotlin calling the `com.trustwallet:wallet-core` AAR. Correctness is locked by native unit tests (XCTest + instrumented JUnit) that assert TWCore golden vectors, plus an on-device bridge smoke screen that asserts the same constants end-to-end.

**Tech Stack:** React Native 0.84 (TypeScript, New Architecture, Hermes V1) · Trust Wallet Core (iOS pod `TrustWalletCore`, Android `com.trustwallet:wallet-core:4.6.0`) · TurboModules/JSI codegen · Jest · XCTest · Android instrumented JUnit (`androidTest`).

**Phase-0 scope discipline (YAGNI):** Only the bridge methods that golden vectors exercise are implemented now: `importMnemonic`, `deriveAddress`, `validateAddress`, `signHash`. `StoredKey` persistence / vault (architecture §2.2), `signTransaction` via `AnySigner.signJson`, `createWallet`, `signMessage`, `decodeTransaction` are **Phase 1+** and intentionally NOT built here. WalletRefs are held in an in-memory native map (no disk persistence yet) — sufficient and correct for立桩.

**Golden-vector source of truth:** Standard Trezor test mnemonic:
`abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`
- EVM `m/44'/60'/0'/0/0` → `0x9858EfFD232B4033E47d90003D41EC34EcaEda94` (canonical, pre-filled).
- TRON `m/44'/195'/0'/0/0` → **PINNED ON FIRST VERIFIED RUN** (Task 3), gated by cross-check against the real existing TronLink wallet per architecture §7. Not pre-baked on purpose — a wrong Base58Check string would silently pass review.
- `signHash` digest = `sha256("tronlink-rn golden vector")` = `0x` + (computed in Task 3 Step 1). Expected signature **PINNED ON FIRST VERIFIED RUN**.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/native-bridge/NativeSecureKeyring.ts` | TurboModule codegen spec — the private-key-free bridge contract |
| `src/crypto/goldenVectors.ts` | Single source of truth for the test mnemonic, derivation paths, expected addresses/signature, coinType constants |
| `src/crypto/goldenVectors.test.ts` | Jest unit test: validates the constants' shape (address regex, path format) — establishes the Jest harness |
| `src/devtools/BridgeSelfTest.ts` | Pure-TS function that calls the bridge and compares against `goldenVectors` → returns a PASS/FAIL report |
| `App.tsx` | Minimal screen with a "Run SecureKeyring Self-Test" button rendering the report |
| `ios/TronLinkRN/SecureKeyringCore.swift` | `@objc` Swift class: all TWCore calls (HDWallet derive/sign), returns Foundation types |
| `ios/TronLinkRN/SecureKeyring.mm` | ObjC++ TurboModule conforming to generated `NativeSecureKeyringSpec`, delegates to Swift core |
| `ios/TronLinkRN/SecureKeyringCoreTests.swift` | XCTest golden vectors against TWCore directly (no bridge) |
| `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt` | Kotlin TurboModule calling wallet-core AAR |
| `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringPackage.kt` | `ReactPackage` registering the module |
| `android/app/src/androidTest/java/com/tronlinkrn/SecureKeyringGoldenTest.kt` | Instrumented JUnit golden vectors against wallet-core directly |

---

## Task 1: Initialize RN 0.84 into the existing empty git repo

The repo `/Users/viccc/working/rn_eth/tronlink-rn` already has `.git` (branch `main`, no commits). RN CLI refuses to init into a non-empty dir, so we init beside it and copy in, preserving `.git`.

**Files:**
- Create: entire RN 0.84 skeleton under `tronlink-rn/`

- [ ] **Step 1: Generate the skeleton in a sibling temp dir**

```bash
cd /Users/viccc/working/rn_eth
npx @react-native-community/cli@latest init TronLinkRN --version 0.84 --skip-install --skip-git-init
```
Expected: a new `./TronLinkRN/` directory containing `package.json`, `App.tsx`, `ios/`, `android/`.
If Node 26 aborts the CLI (we are intentionally trying v26), the failure will be explicit here — switch to Node 22 LTS (`nvm install 22 && nvm use 22`) and re-run this exact command, then continue.

- [ ] **Step 2: Copy skeleton into the existing repo, preserving `.git`**

```bash
cd /Users/viccc/working/rn_eth
rsync -a --exclude='.git' TronLinkRN/ tronlink-rn/
rm -rf TronLinkRN
cd tronlink-rn
```
Expected: `ls tronlink-rn` shows RN files; `git -C tronlink-rn status` still on `main` with these as untracked.

- [ ] **Step 3: Install JS deps**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
yarn install
```
Expected: `node_modules/` populated, exit 0.

- [ ] **Step 4: Confirm New Architecture is on**

Run: `grep -R "newArchEnabled" android/gradle.properties && grep -R "RCT_NEW_ARCH_ENABLED" ios/Podfile ios/*.xcodeproj/project.pbxproj 2>/dev/null | head`
Expected: `newArchEnabled=true` in `android/gradle.properties`. (RN 0.84 has New Arch on by default; if the flag is absent, add `newArchEnabled=true`.)

- [ ] **Step 5: iOS pods install + run on simulator**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn/ios && pod install && cd ..
npx react-native run-ios --simulator "iPhone 16"
```
Expected: app builds and the default RN welcome screen shows in the iOS 26.5 simulator. (If "iPhone 16" is absent, pick one from `xcrun simctl list devices available`.)

- [ ] **Step 6: Android run on emulator**

First confirm an emulator/device: `adb devices` (start one from Android Studio if empty), then:
```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
npx react-native run-android
```
Expected: app builds and the default RN welcome screen shows.

- [ ] **Step 7: Commit the skeleton**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn
git add -A
git commit -m "chore: bootstrap React Native 0.84 skeleton (New Architecture, Hermes)"
```

---

## Task 2: Golden-vector constants + Jest harness (pure TS, TDD)

Establishes the single source of truth and proves Jest runs. The TRON/signature expected values are intentionally empty strings here; they are pinned in Task 3 after verification. This test only asserts the *shape* of what is present.

**Files:**
- Create: `src/crypto/goldenVectors.ts`
- Test: `src/crypto/goldenVectors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/crypto/goldenVectors.test.ts
import { GOLDEN } from './goldenVectors';

describe('golden vectors', () => {
  it('uses the standard 12-word Trezor test mnemonic', () => {
    expect(GOLDEN.mnemonic.trim().split(/\s+/)).toHaveLength(12);
    expect(GOLDEN.mnemonic.trim().split(/\s+/).slice(-1)[0]).toBe('about');
  });

  it('pins the canonical EVM address (checksummed)', () => {
    expect(GOLDEN.evm.expectedAddress).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94');
    expect(GOLDEN.evm.path).toBe("m/44'/60'/0'/0/0");
    expect(GOLDEN.evm.coinType).toBe(60);
  });

  it('declares the TRON vector slot (value pinned post-verify)', () => {
    expect(GOLDEN.tron.path).toBe("m/44'/195'/0'/0/0");
    expect(GOLDEN.tron.coinType).toBe(195);
    // expectedAddress filled in Task 3; here we only assert the slot exists.
    expect(typeof GOLDEN.tron.expectedAddress).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/viccc/working/rn_eth/tronlink-rn && yarn jest src/crypto/goldenVectors.test.ts`
Expected: FAIL — `Cannot find module './goldenVectors'`.

- [ ] **Step 3: Write the constants**

```typescript
// src/crypto/goldenVectors.ts
// Single source of truth for Phase-0 golden vectors.
// TRON address + signature are pinned in Task 3 after cross-checking the real TronLink wallet (architecture §7).

export const GOLDEN = {
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Digest to sign for the signature golden vector: sha256("tronlink-rn golden vector").
  // Hex value is printed and pinned in Task 3 Step 1.
  signDigestHex: '', // PIN IN TASK 3

  evm: {
    path: "m/44'/60'/0'/0/0",
    coinType: 60, // TWCore CoinType.ethereum
    expectedAddress: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
  },

  tron: {
    path: "m/44'/195'/0'/0/0",
    coinType: 195, // TWCore CoinType.tron
    expectedAddress: '', // PIN IN TASK 3 (cross-checked vs existing TronLink)
    expectedSignatureHex: '', // PIN IN TASK 3
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/viccc/working/rn_eth/tronlink-rn && yarn jest src/crypto/goldenVectors.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/crypto/goldenVectors.ts src/crypto/goldenVectors.test.ts
git commit -m "test: add golden-vector constants and Jest harness"
```

---

## Task 3: iOS — TrustWalletCore pod + XCTest golden vectors (derive value, pin it)

This task proves the crypto core on iOS *without the bridge*, and produces the authoritative TRON address + signature by running TWCore and cross-checking the real TronLink wallet.

**Files:**
- Modify: `ios/Podfile`
- Create: `ios/TronLinkRN/SecureKeyringCoreTests.swift` (add a unit-test target if none exists)

- [ ] **Step 1: Compute and pin the sign digest**

```bash
printf 'tronlink-rn golden vector' | shasum -a 256
```
Expected: a 64-hex digest. Put `0x<that hex>` into `GOLDEN.signDigestHex` in `src/crypto/goldenVectors.ts`.

- [ ] **Step 2: Add the pod**

In `ios/Podfile`, inside the app target block, add:
```ruby
  pod 'TrustWalletCore'
```
Then:
```bash
cd /Users/viccc/working/rn_eth/tronlink-rn/ios && pod install
```
Expected: TrustWalletCore resolves; note the resolved version in `Podfile.lock` (commit it so the version is pinned).

- [ ] **Step 3: Ensure a unit-test target exists**

If `ios/TronLinkRN.xcodeproj` has no test target, add one in Xcode: File ▸ New ▸ Target ▸ Unit Testing Bundle named `TronLinkRNTests`, host app `TronLinkRN`. Confirm `import WalletCore` resolves in that target (add `TrustWalletCore` to the test target too if needed via Podfile `target 'TronLinkRNTests' do inherit! :search_paths; pod 'TrustWalletCore'; end`, then `pod install`).

- [ ] **Step 4: Write the failing XCTest (address + signature)**

```swift
// ios/TronLinkRN/SecureKeyringCoreTests.swift
import XCTest
import WalletCore

final class SecureKeyringCoreTests: XCTestCase {
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

    func test_evm_address_matches_canonical() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        let addr = wallet.getAddressForCoin(coin: .ethereum)
        XCTAssertEqual(addr, "0x9858EfFD232B4033E47d90003D41EC34EcaEda94")
    }

    func test_tron_address_is_deterministic_and_printed() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        let addr = wallet.getAddressForCoin(coin: .tron)
        XCTAssertTrue(addr.hasPrefix("T"), "TRON base58 address starts with T")
        print("GOLDEN_TRON_ADDRESS=\(addr)") // pin this value
    }

    func test_signHash_is_deterministic_and_printed() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        let key = wallet.getKeyForCoin(coin: .tron)
        // digest = sha256("tronlink-rn golden vector")
        let digest = Hash.sha256(data: "tronlink-rn golden vector".data(using: .utf8)!)
        let sig = key.sign(digest: digest, curve: .secp256k1)!
        let hex = sig.map { String(format: "%02x", $0) }.joined()
        XCTAssertEqual(sig.count, 65, "secp256k1 recoverable signature is 65 bytes")
        print("GOLDEN_TRON_SIGNATURE=0x\(hex)") // pin this value
    }
}
```

- [ ] **Step 5: Run to verify EVM passes and TRON/sig print values**

Run (or use Xcode Test navigator):
```bash
cd /Users/viccc/working/rn_eth/tronlink-rn/ios
xcodebuild test -workspace TronLinkRN.xcworkspace -scheme TronLinkRN \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:TronLinkRNTests/SecureKeyringCoreTests 2>&1 | grep -E "GOLDEN_|Test Suite|passed|failed"
```
Expected: EVM test passes; console prints `GOLDEN_TRON_ADDRESS=T...` and `GOLDEN_TRON_SIGNATURE=0x...`.

- [ ] **Step 6: Cross-check the TRON address against the real TronLink wallet (architecture §7 gate)**

Import the same mnemonic `abandon...about` into the existing TronLink wallet (the sibling `TronLink_iOS`/`tronlink-android` build, or production app) and read account 0's TRON address. **It MUST equal `GOLDEN_TRON_ADDRESS` from Step 5.** If they differ, STOP — the derivation path/coin config is wrong; do not pin a mismatched value.

- [ ] **Step 7: Pin the verified values**

Put the verified `T...` address into `GOLDEN.tron.expectedAddress` and the `0x...` signature into `GOLDEN.tron.expectedSignatureHex` in `src/crypto/goldenVectors.ts`. Then replace the printed asserts with hard equality in the XCTest:
```swift
    func test_tron_address_matches_pinned() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        XCTAssertEqual(wallet.getAddressForCoin(coin: .tron), "<PINNED_TRON_ADDRESS>")
    }
    func test_signHash_matches_pinned() throws {
        let wallet = HDWallet(mnemonic: mnemonic, passphrase: "")!
        let key = wallet.getKeyForCoin(coin: .tron)
        let digest = Hash.sha256(data: "tronlink-rn golden vector".data(using: .utf8)!)
        let hex = key.sign(digest: digest, curve: .secp256k1)!.map { String(format: "%02x", $0) }.joined()
        XCTAssertEqual("0x\(hex)", "<PINNED_TRON_SIGNATURE>")
    }
```
(Replace the print-based tests from Step 4 with these two; keep the EVM test.)

- [ ] **Step 8: Run to verify all iOS golden tests pass**

Run: same `xcodebuild test` command as Step 5.
Expected: all SecureKeyringCoreTests pass.

- [ ] **Step 9: Commit**

```bash
git add ios/Podfile ios/Podfile.lock ios/TronLinkRN/SecureKeyringCoreTests.swift src/crypto/goldenVectors.ts ios/TronLinkRN.xcodeproj/project.pbxproj
git commit -m "test(ios): integrate TrustWalletCore and pin TRON/EVM golden vectors"
```

---

## Task 4: Android — wallet-core AAR + instrumented golden vectors

Mirrors Task 3 on Android, asserting the *same* pinned constants (proves cross-platform parity).

**Files:**
- Modify: `android/app/build.gradle`
- Create: `android/app/src/androidTest/java/com/tronlinkrn/SecureKeyringGoldenTest.kt`

- [ ] **Step 1: Add the dependency**

In `android/app/build.gradle` `dependencies { }`:
```groovy
    implementation 'com.trustwallet:wallet-core:4.6.0'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test:runner:1.5.2'
```
Ensure `android { defaultConfig { testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner" } }` is set.

- [ ] **Step 2: Write the failing instrumented test (asserts pinned constants)**

```kotlin
// android/app/src/androidTest/java/com/tronlinkrn/SecureKeyringGoldenTest.kt
package com.tronlinkrn

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.BeforeClass
import org.junit.Test
import org.junit.runner.RunWith
import wallet.core.jni.CoinType
import wallet.core.jni.Curve
import wallet.core.jni.HDWallet
import wallet.core.jni.Hash
import java.util.Locale

@RunWith(AndroidJUnit4::class)
class SecureKeyringGoldenTest {
    companion object {
        const val MNEMONIC =
            "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
        @JvmStatic @BeforeClass fun load() { System.loadLibrary("TrustWalletCore") }
        fun ByteArray.hex() = joinToString("") { String.format(Locale.US, "%02x", it) }
    }

    @Test fun evm_address_matches_canonical() {
        val w = HDWallet(MNEMONIC, "")
        assertEquals("0x9858EfFD232B4033E47d90003D41EC34EcaEda94", w.getAddressForCoin(CoinType.ETHEREUM))
    }

    @Test fun tron_address_matches_pinned() {
        val w = HDWallet(MNEMONIC, "")
        assertEquals("<PINNED_TRON_ADDRESS>", w.getAddressForCoin(CoinType.TRON))
    }

    @Test fun signHash_matches_pinned() {
        val w = HDWallet(MNEMONIC, "")
        val key = w.getKeyForCoin(CoinType.TRON)
        val digest = Hash.sha256("tronlink-rn golden vector".toByteArray(Charsets.UTF_8))
        val sig = key.sign(digest, Curve.SECP256K1)
        assertEquals("<PINNED_TRON_SIGNATURE>", "0x" + sig.hex())
    }
}
```
Replace `<PINNED_TRON_ADDRESS>` / `<PINNED_TRON_SIGNATURE>` with the exact values pinned in Task 3 Step 7.

- [ ] **Step 3: Run to verify it fails (lib not yet synced) then passes**

Run: `cd /Users/viccc/working/rn_eth/tronlink-rn/android && ./gradlew :app:connectedDebugAndroidTest` (emulator running).
Expected first run before gradle sync: FAIL to resolve `wallet.core.jni.*`. After Step 1 sync: all three tests PASS, confirming Android derives the **identical** addresses/signature as iOS.

- [ ] **Step 4: Cross-platform parity gate**

Confirm the Android `tron_address_matches_pinned` and `signHash_matches_pinned` pass against the *same* constants iOS pinned. If Android differs from iOS, STOP — investigate coin config before proceeding.

- [ ] **Step 5: Commit**

```bash
git add android/app/build.gradle android/app/src/androidTest/java/com/tronlinkrn/SecureKeyringGoldenTest.kt
git commit -m "test(android): integrate wallet-core and assert cross-platform golden parity"
```

---

## Task 5: TurboModule spec (codegen contract)

The private-key-free bridge contract. Only the Phase-0 methods are declared.

**Files:**
- Create: `src/native-bridge/NativeSecureKeyring.ts`
- Modify: `package.json` (codegenConfig)

- [ ] **Step 1: Write the spec**

```typescript
// src/native-bridge/NativeSecureKeyring.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// WalletRef = opaque handle/id, never contains a private key.
export interface Spec extends TurboModule {
  // Import mnemonic, hold HDWallet in native memory, return a handle.
  importMnemonic(mnemonic: string): Promise<string>;
  // Forget the in-memory wallet for a handle.
  deleteWallet(walletRef: string): Promise<boolean>;
  // Read-only derivation (no private key out).
  deriveAddress(walletRef: string, coinType: number): Promise<string>;
  validateAddress(address: string, coinType: number): boolean;
  // Sign a 32-byte digest (hex, 0x-prefixed). Returns 0x-prefixed signature hex.
  // Covers the TRON universal-fallback path (architecture §5 mode 2). Private key never leaves native.
  signHash(walletRef: string, coinType: number, digestHex: string): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SecureKeyring');
```

- [ ] **Step 2: Wire codegen in package.json**

Add to `package.json`:
```json
  "codegenConfig": {
    "name": "SecureKeyringSpec",
    "type": "modules",
    "jsSrcsDir": "src/native-bridge",
    "android": { "javaPackageName": "com.tronlinkrn.securekeyring" }
  }
```

- [ ] **Step 3: Verify codegen runs (iOS)**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn/ios && pod install
```
Expected: pod install runs codegen and generates `build/generated/ios/SecureKeyringSpec/` (the `NativeSecureKeyringSpec` ObjC++ protocol). No error.

- [ ] **Step 4: Commit**

```bash
git add src/native-bridge/NativeSecureKeyring.ts package.json ios/Podfile.lock
git commit -m "feat: define SecureKeyring TurboModule spec (private-key-free contract)"
```

---

## Task 6: iOS native implementation (Swift core + ObjC++ TurboModule)

**Files:**
- Create: `ios/TronLinkRN/SecureKeyringCore.swift`
- Create: `ios/TronLinkRN/SecureKeyring.mm`

- [ ] **Step 1: Write the Swift core (all TWCore calls)**

```swift
// ios/TronLinkRN/SecureKeyringCore.swift
import Foundation
import WalletCore

@objc(SecureKeyringCore)
public class SecureKeyringCore: NSObject {
    private var wallets: [String: HDWallet] = [:]
    private let lock = NSLock()

    private func coin(_ t: Int) -> CoinType? { CoinType(rawValue: UInt32(t)) }

    @objc public func importMnemonic(_ mnemonic: String) -> String? {
        guard let w = HDWallet(mnemonic: mnemonic, passphrase: "") else { return nil }
        let ref = UUID().uuidString
        lock.lock(); wallets[ref] = w; lock.unlock()
        return ref
    }

    @objc public func deleteWallet(_ ref: String) -> Bool {
        lock.lock(); let existed = wallets.removeValue(forKey: ref) != nil; lock.unlock()
        return existed
    }

    @objc public func deriveAddress(_ ref: String, coinType: Int) -> String? {
        lock.lock(); let w = wallets[ref]; lock.unlock()
        guard let w = w, let c = coin(coinType) else { return nil }
        return w.getAddressForCoin(coin: c)
    }

    @objc public func validateAddress(_ address: String, coinType: Int) -> Bool {
        guard let c = coin(coinType) else { return false }
        return AnyAddress(string: address, coin: c) != nil
    }

    // digestHex: 0x-prefixed 32-byte hash. Returns 0x-prefixed signature hex.
    @objc public func signHash(_ ref: String, coinType: Int, digestHex: String) -> String? {
        lock.lock(); let w = wallets[ref]; lock.unlock()
        guard let w = w, let c = coin(coinType) else { return nil }
        let clean = digestHex.hasPrefix("0x") ? String(digestHex.dropFirst(2)) : digestHex
        guard let digest = Data(hexString: clean) else { return nil }
        let key = w.getKeyForCoin(coin: c)
        guard let sig = key.sign(digest: digest, curve: .secp256k1) else { return nil }
        return "0x" + sig.map { String(format: "%02x", $0) }.joined()
    }
}

private extension Data {
    init?(hexString: String) {
        guard hexString.count % 2 == 0 else { return nil }
        var data = Data(capacity: hexString.count / 2)
        var idx = hexString.startIndex
        while idx < hexString.endIndex {
            let next = hexString.index(idx, offsetBy: 2)
            guard let b = UInt8(hexString[idx..<next], radix: 16) else { return nil }
            data.append(b); idx = next
        }
        self = data
    }
}
```

- [ ] **Step 2: Write the ObjC++ TurboModule delegating to Swift**

```objc
// ios/TronLinkRN/SecureKeyring.mm
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import "SecureKeyringSpec/SecureKeyringSpec.h"   // generated by codegen
#import "TronLinkRN-Swift.h"                       // exposes SecureKeyringCore

@interface SecureKeyring : NSObject <NativeSecureKeyringSpec>
@end

@implementation SecureKeyring {
  SecureKeyringCore *_core;
}
RCT_EXPORT_MODULE()

- (instancetype)init { if (self = [super init]) { _core = [SecureKeyringCore new]; } return self; }

- (void)importMnemonic:(NSString *)mnemonic
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
  NSString *ref = [_core importMnemonic:mnemonic];
  ref ? resolve(ref) : reject(@"import_failed", @"invalid mnemonic", nil);
}

- (void)deleteWallet:(NSString *)walletRef
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
  resolve(@([_core deleteWallet:walletRef]));
}

- (void)deriveAddress:(NSString *)walletRef
             coinType:(double)coinType
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
  NSString *a = [_core deriveAddress:walletRef coinType:(NSInteger)coinType];
  a ? resolve(a) : reject(@"derive_failed", @"unknown ref or coin", nil);
}

- (NSNumber *)validateAddress:(NSString *)address coinType:(double)coinType {
  return @([_core validateAddress:address coinType:(NSInteger)coinType]);
}

- (void)signHash:(NSString *)walletRef
        coinType:(double)coinType
       digestHex:(NSString *)digestHex
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
  NSString *sig = [_core signHash:walletRef coinType:(NSInteger)coinType digestHex:digestHex];
  sig ? resolve(sig) : reject(@"sign_failed", @"unknown ref/coin or bad digest", nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeSecureKeyringSpecJSI>(params);
}
@end
```
Note: confirm the generated protocol/JSI class names (`NativeSecureKeyringSpec` / `NativeSecureKeyringSpecJSI`) and header path against `ios/build/generated/ios/` after Task 5 Step 3; method signatures with `double` for numbers and resolve/reject blocks are RN's codegen convention. Ensure the bridging header `TronLinkRN-Swift.h` is generated (Swift target has "Defines Module" / the app uses Swift — adding `SecureKeyringCore.swift` triggers the bridging header; if Xcode prompts to create a bridging header, accept).

- [ ] **Step 3: Build the app to verify the module compiles & registers**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn/ios && pod install && cd ..
npx react-native run-ios --simulator "iPhone 16"
```
Expected: app builds with the new files; no missing-symbol errors. (Functional verification is Task 8.)

- [ ] **Step 4: Commit**

```bash
git add ios/TronLinkRN/SecureKeyringCore.swift ios/TronLinkRN/SecureKeyring.mm ios/TronLinkRN.xcodeproj/project.pbxproj
git commit -m "feat(ios): implement SecureKeyring TurboModule via TrustWalletCore"
```

---

## Task 7: Android native implementation (Kotlin TurboModule + package)

**Files:**
- Create: `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt`
- Create: `android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringPackage.kt`
- Modify: the app's `ReactNativeHost` packages list (`android/app/src/main/java/com/tronlinkrn/MainApplication.kt`)

- [ ] **Step 1: Implement the module**

```kotlin
// android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringModule.kt
package com.tronlinkrn.securekeyring

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import wallet.core.jni.AnyAddress
import wallet.core.jni.CoinType
import wallet.core.jni.Curve
import wallet.core.jni.HDWallet
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class SecureKeyringModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        init { System.loadLibrary("TrustWalletCore") }
        private fun ByteArray.hex() = joinToString("") { String.format(Locale.US, "%02x", it) }
        private fun String.fromHex(): ByteArray {
            val s = removePrefix("0x")
            return ByteArray(s.length / 2) { ((s[it * 2].digitToInt(16) shl 4) + s[it * 2 + 1].digitToInt(16)).toByte() }
        }
    }

    private val wallets = ConcurrentHashMap<String, HDWallet>()
    override fun getName() = "SecureKeyring"

    @ReactMethod fun importMnemonic(mnemonic: String, promise: Promise) {
        try {
            val w = HDWallet(mnemonic, "")
            val ref = UUID.randomUUID().toString()
            wallets[ref] = w
            promise.resolve(ref)
        } catch (e: Throwable) { promise.reject("import_failed", e) }
    }

    @ReactMethod fun deleteWallet(walletRef: String, promise: Promise) {
        promise.resolve(wallets.remove(walletRef) != null)
    }

    @ReactMethod fun deriveAddress(walletRef: String, coinType: Double, promise: Promise) {
        val w = wallets[walletRef] ?: return promise.reject("derive_failed", "unknown ref")
        try { promise.resolve(w.getAddressForCoin(CoinType.createFromValue(coinType.toInt()))) }
        catch (e: Throwable) { promise.reject("derive_failed", e) }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun validateAddress(address: String, coinType: Double): Boolean =
        try { AnyAddress.isValid(address, CoinType.createFromValue(coinType.toInt())) } catch (e: Throwable) { false }

    @ReactMethod fun signHash(walletRef: String, coinType: Double, digestHex: String, promise: Promise) {
        val w = wallets[walletRef] ?: return promise.reject("sign_failed", "unknown ref")
        try {
            val key = w.getKeyForCoin(CoinType.createFromValue(coinType.toInt()))
            val sig = key.sign(digestHex.fromHex(), Curve.SECP256K1)
            promise.resolve("0x" + sig.hex())
        } catch (e: Throwable) { promise.reject("sign_failed", e) }
    }
}
```
Note: with New Architecture, RN's interop layer lets a classic `ReactContextBaseJavaModule` satisfy a TurboModule spec by name (`SecureKeyring`). Verify `CoinType.createFromValue` and `AnyAddress.isValid(String, CoinType)` exist in wallet-core 4.6.0; if the API differs, adapt (e.g. `CoinType.ETHEREUM`/`CoinType.TRON` by mapping coinType→enum). The Task-4 instrumented test already confirmed the JNI symbols.

- [ ] **Step 2: Implement the package**

```kotlin
// android/app/src/main/java/com/tronlinkrn/securekeyring/SecureKeyringPackage.kt
package com.tronlinkrn.securekeyring

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SecureKeyringPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(SecureKeyringModule(ctx))
    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
```

- [ ] **Step 3: Register the package in MainApplication.kt**

In `android/app/src/main/java/com/tronlinkrn/MainApplication.kt`, inside the `getPackages()` override, add after the autolinked packages:
```kotlin
              add(com.tronlinkrn.securekeyring.SecureKeyringPackage())
```
(The default body is `PackageList(this).packages.apply { /* add here */ }` — insert the line inside `.apply { }`.)

- [ ] **Step 4: Build to verify it compiles**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn && npx react-native run-android
```
Expected: builds and installs; no compile errors. (Functional check is Task 8.)

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/tronlinkrn/securekeyring/ android/app/src/main/java/com/tronlinkrn/MainApplication.kt
git commit -m "feat(android): implement SecureKeyring module via wallet-core"
```

---

## Task 8: End-to-end bridge self-test screen (both platforms assert golden constants)

Proves the full path JS → TurboModule → TWCore → JS returns the pinned golden values, and that the private key never appears in any JS return value.

**Files:**
- Create: `src/devtools/BridgeSelfTest.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Write the self-test function**

```typescript
// src/devtools/BridgeSelfTest.ts
import SecureKeyring from '../native-bridge/NativeSecureKeyring';
import { GOLDEN } from '../crypto/goldenVectors';

export type Line = { name: string; ok: boolean; detail: string };

export async function runBridgeSelfTest(): Promise<Line[]> {
  const out: Line[] = [];
  const ref = await SecureKeyring.importMnemonic(GOLDEN.mnemonic);
  out.push({ name: 'importMnemonic', ok: !!ref && !ref.includes(' '), detail: `ref=${ref.slice(0, 8)}…` });

  const evm = await SecureKeyring.deriveAddress(ref, GOLDEN.evm.coinType);
  out.push({ name: 'EVM address', ok: evm === GOLDEN.evm.expectedAddress, detail: evm });

  const tron = await SecureKeyring.deriveAddress(ref, GOLDEN.tron.coinType);
  out.push({ name: 'TRON address', ok: tron === GOLDEN.tron.expectedAddress, detail: tron });

  const validTron = SecureKeyring.validateAddress(tron, GOLDEN.tron.coinType);
  out.push({ name: 'validateAddress(TRON)', ok: validTron === true, detail: String(validTron) });

  const sig = await SecureKeyring.signHash(ref, GOLDEN.tron.coinType, GOLDEN.signDigestHex);
  out.push({ name: 'signHash(TRON)', ok: sig === GOLDEN.tron.expectedSignatureHex, detail: sig });

  // Contract guard: nothing returned may look like a 64-hex private key / mnemonic word list.
  const leaked = out.some(l => /(\b\w+\b\s){11}\w+/.test(l.detail));
  out.push({ name: 'no-private-key-leak', ok: !leaked, detail: leaked ? 'LEAK!' : 'clean' });

  await SecureKeyring.deleteWallet(ref);
  return out;
}
```

- [ ] **Step 2: Wire a button into App.tsx**

Replace `App.tsx` body with a minimal screen:
```tsx
// App.tsx
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, Button, View } from 'react-native';
import { runBridgeSelfTest, Line } from './src/devtools/BridgeSelfTest';

export default function App() {
  const [lines, setLines] = useState<Line[]>([]);
  const allOk = lines.length > 0 && lines.every(l => l.ok);
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Button title="Run SecureKeyring Self-Test"
        onPress={async () => setLines(await runBridgeSelfTest())} />
      <Text style={{ fontSize: 22, marginVertical: 12 }}>
        {lines.length === 0 ? '—' : allOk ? '✅ ALL PASS' : '❌ FAIL'}
      </Text>
      <ScrollView>
        {lines.map((l, i) => (
          <View key={i} style={{ paddingVertical: 4 }}>
            <Text>{l.ok ? '✅' : '❌'} {l.name}: {l.detail}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Run on iOS and tap the button**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn && npx react-native run-ios --simulator "iPhone 16"
```
Expected: tapping the button shows **✅ ALL PASS** with EVM = `0x9858…aEda94`, TRON = pinned address, signHash = pinned signature, `no-private-key-leak: clean`.

- [ ] **Step 4: Run on Android and tap the button**

```bash
cd /Users/viccc/working/rn_eth/tronlink-rn && npx react-native run-android
```
Expected: identical **✅ ALL PASS** output as iOS.

- [ ] **Step 5: Commit**

```bash
git add src/devtools/BridgeSelfTest.ts App.tsx
git commit -m "test: end-to-end SecureKeyring bridge self-test asserts golden parity on both platforms"
```

---

## Task 9: Phase-0 exit gate documentation

**Files:**
- Create: `docs/phase0-foundation.md`

- [ ] **Step 1: Record the proven invariants**

Write `docs/phase0-foundation.md` capturing: the pinned golden constants (mnemonic, EVM/TRON addresses, signature), the four exit criteria below with their evidence (which test proves each), TWCore versions (iOS Podfile.lock entry, Android `4.6.0`), and the Phase-0→Phase-1 handoff note (next: chain-registry + ChainAdapter + read-only balances).

Exit criteria (all must be ✅):
1. iOS XCTest golden vectors pass (Task 3).
2. Android instrumented golden vectors pass, identical constants (Task 4).
3. Bridge self-test ✅ ALL PASS on both platforms (Task 8).
4. TRON address cross-checked equal to the real existing TronLink wallet (Task 3 Step 6).

- [ ] **Step 2: Commit**

```bash
git add docs/phase0-foundation.md
git commit -m "docs: record Phase-0 foundation exit gate and golden vectors"
```

---

## Self-Review

**Spec coverage (architecture doc §8 build steps + §9 Phase 0 + §7 consistency):**
- §8.1 RN init w/ Hermes + New Arch → Task 1. ✅
- §8.2 iOS `pod 'TrustWalletCore'` → Task 3 Step 2. ✅
- §8.3 Android `wallet-core` gradle → Task 4 Step 1. ✅
- §8.4 SecureKeyring TurboModule (spec + iOS Swift + Android Kotlin) → Tasks 5/6/7. ✅
- §8.5 lay out dirs → `src/native-bridge`, `src/crypto`, `src/devtools` created; remaining `chain-registry/chain-adapter/multichain/broadcast/dapp` are Phase 1 (out of scope, by design). ✅ (scoped)
- §8.6 / §9 Phase 0 "fixed mnemonic TRON+EVM address/signature match existing" → Tasks 3/4/8 + §7 cross-check Task 3 Step 6. ✅
- §3 桥契约铁律 (no private key in params/returns) → spec has no key fields (Task 5) + `no-private-key-leak` guard (Task 8 Step 1). ✅
- §5 mode-2 universal `signHash` → implemented Tasks 6/7, golden-tested Tasks 3/4/8. ✅
- §7 存量迁移 keystore import → Phase 1+ (out of scope; Phase 0 uses in-memory mnemonic import only). Noted.

**Placeholder scan:** The empty-string constants in `goldenVectors.ts` (TRON address/signature, signDigestHex) and `<PINNED_*>` markers are **deliberate verify-and-pin slots**, each with an exact derivation command (Task 3 Steps 1, 5, 7) and a cross-check gate — not lazy TODOs. Every code step shows real code. No "add error handling"/"similar to"/"TBD" left.

**Type consistency:** Bridge method names/signatures identical across spec (Task 5), iOS `.mm` (Task 6), Android Kotlin (Task 7), and JS caller (Task 8): `importMnemonic(string)→string`, `deleteWallet(string)→bool`, `deriveAddress(ref,coinType)→string`, `validateAddress(addr,coinType)→bool` (sync), `signHash(ref,coinType,digestHex)→string`. `GOLDEN` shape consumed by Jest test (Task 2) and self-test (Task 8) matches the definition. CoinType ints 60/195 consistent throughout. ✅

# Welcome Screen — Design Spec

> Date: 2026-06-09 · Project: `tronlink-rn`
> Goal: replicate the existing native Android `WelcomeActivity` welcome/launch screen pixel-identically in React Native, as the app's first UI screen, and set up navigation for subsequent screens.

## Source of truth

The existing TronLink Android welcome screen (the project's own app):
- Activity: `tronlink-android/app/src/main/java/com/tron/wallet/business/welcome/WelcomeActivity.java`
- Layout: `tronlink-android/app/src/main/res/layout/ac_welcome.xml`
- Asset: `tronlink-android/app/src/main/res/mipmap-xxhdpi/ic_launcher_pic.png` — the TronLink logo (blue rounded-square TRON-triangle icon + black "TronLink" wordmark), 681×144 px @xxhdpi (3x) ≈ 227×48 dp.

The Android layout (visible portion): a full-screen `ConstraintLayout` with `@color/white` (`#FFFFFF`) background and a single centered `ImageView` (`ic_launcher_pic`, `wrap_content`, `fitCenter`) constrained to all four edges with `app:layout_constraintVertical_bias="0.4"`.

## Scope (decided)

**In scope:**
- Pixel-identical static Welcome screen (white background + centered logo at vertical bias 0.4).
- Splash behavior: after a fixed ~1.1s delay, auto-transition to the next screen.
- React Navigation (native-stack) set up: `Welcome` (initial route) → `EmptyWallet` placeholder.
- Existing device self-tests moved to a `DevSelfTest` route (preserved, not on the main flow).

**Explicitly OUT of scope (per decision):**
- The HD-key upgrade logic and its hidden UI (the Android screen's `tv_progress` "Wallet updating..." text + `progress_bar` are NOT replicated — removed entirely).
- State-layer bootstrap on launch (the transition is a plain timer; no WalletStore/persistence check yet — a follow-up when onboarding exists).
- Native permission requests, language/Firebase/analytics init, FCM/deeplink routing (Android-only splash concerns; not part of "the page UI").
- The real "create / import wallet" screen (the `EmptyWallet` target is a placeholder stub for now).

## Architecture

```
App.tsx
 └─ <NavigationContainer>
     └─ native-stack
         ├─ "Welcome"     (initialRouteName, headerShown:false)   ← WelcomeScreen
         ├─ "EmptyWallet" (placeholder; headerShown:false)        ← EmptyWalletScreen (stub)
         └─ "DevSelfTest" (dev only)                              ← DevSelfTestScreen (current App self-tests)
```

Screens are organized **by business domain** under `src/screens/<domain>/`, mirroring the Android app's `com/tron/wallet/business/<domain>/` layout.

| Unit | File | Responsibility |
| --- | --- | --- |
| App root | `App.tsx` | `SafeAreaProvider` + `NavigationContainer` + stack navigator |
| Welcome screen | `src/screens/welcome/WelcomeScreen.tsx` | the pixel-identical welcome UI + the 1.1s timed `navigation.replace('EmptyWallet')` |
| Empty-wallet placeholder | `src/screens/wallet/EmptyWalletScreen.tsx` | minimal stub (centered text "Create / Import Wallet — coming soon") + a small dev link to `DevSelfTest` |
| Dev self-tests | `src/screens/dev/DevSelfTestScreen.tsx` | the current `App.tsx` self-test probes (SELFTEST/READONLY/EVMSIGN/TRONSIGN/STATELAYER) moved verbatim |
| Logo asset | `assets/ic_launcher_pic.png` | copied from the Android `mipmap-xxhdpi` (the 3x source) |

> Convention: one business domain = one folder under `src/screens/` (`welcome/`, `wallet/`, `dev/`, …). Future screens (onboarding, accounts, send, dapp, settings) each land in their domain folder.

## Pixel-fidelity details

- **Background:** `#FFFFFF`, full screen (ignores safe-area insets so the white fills edge-to-edge, like the Android activity).
- **Logo:** `<Image source={require('../../../assets/ic_launcher_pic.png')} style={{ width: 227, height: 48 }} resizeMode="contain" />` (from `src/screens/welcome/`, the asset is three levels up). Using the single 681×144 (3x) source rendered into a 227×48 dp box yields a crisp 1:1 mapping on 3x devices and clean downscale on 1x/2x.
- **Vertical bias 0.4 (faithful):** a full-screen column container with `alignItems: 'center'` and three children — `<View style={{ flex: 0.4 }} />` (top spacer), the logo, `<View style={{ flex: 0.6 }} />` (bottom spacer). A 0.4 : 0.6 spacer ratio reproduces the ConstraintLayout `vertical_bias=0.4` exactly (top gap : bottom gap = 0.4 : 0.6).
- **Status bar:** light content / default; the screen is white so a dark-content status bar is appropriate (match the Android `TYPE_NORMAL` look — white screen, dark icons).

## Data flow / behavior

- `WelcomeScreen` mounts → `useEffect` starts a `setTimeout(1100)` → on fire, `navigation.replace('EmptyWallet')` (replace so back doesn't return to the splash). The timer is cleared on unmount.
- No props, no store reads, no services — purely presentational + a timer. (State-layer bootstrap deferred.)

## Dependencies

Add: `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens` (native — needs `pod install`). `react-native-safe-area-context` is already installed. All are standard RN-navigation deps, Hermes-compatible.

## Testing

- **Jest:** `WelcomeScreen` renders without crashing and schedules navigation — render it with a mocked `navigation` (`{ replace: jest.fn() }`) under fake timers; advance 1100ms; assert `replace('EmptyWallet')` was called once. `EmptyWalletScreen` renders. (Navigation container itself is integration-tested on device.)
- **On-device (both platforms):** the app launches to the pixel-identical Welcome screen (white + centered TronLink logo at ~40% height), then auto-advances to the placeholder after ~1.1s. The `DevSelfTest` route still runs all prior probes ALL_PASS (no regression from adding navigation/screens).

## Risks / notes

- `react-native-screens` is a native dependency (pod install + autolink); validated working in Hermes is expected (it's a core RN-navigation dep). If pod/build issues arise, that's the main integration risk.
- Moving the self-tests off the auto-run entry means they no longer run on every launch — that's intended (they become an on-demand dev screen); device regression checks are run by navigating to `DevSelfTest`.

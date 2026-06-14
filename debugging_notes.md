# Debugging Notes for Next Session

## 1. ✅ NativeWind Dark Mode Toggle Issue — RESOLVED
- **Root Cause**: `_layout.tsx` was hardcoding `mode="light"` on `GluestackUIProvider`, ignoring the device's system appearance setting entirely.
- **Fix Applied** (`app/_layout.tsx`):
  - Imported `useColorScheme` from `react-native` (aliased as `useDeviceColorScheme`).
  - Passed `mode={deviceColorScheme === "dark" ? "dark" : "light"}` to `GluestackUIProvider`.
  - Added `dark:bg-background-dark` className to the wrapper `<View>` for NativeWind dark mode class support.
  - The `GluestackUIProvider` internally calls NativeWind's `setColorScheme(mode)` via `useEffect`, which propagates the `dark:` variant throughout the app.
- **Note**: `tailwind.config.js` already has `darkMode: 'class'` and the `config.ts` already defines both light/dark CSS variable maps — no changes needed there.

## 2. ✅ Gluestack UI Toast Not Firing — RESOLVED
- **Root Cause**: `@legendapp/motion` v2.4.0's `Motion.View` and `AnimatePresence` have compatibility issues with React 19.1.0 / React Native 0.81.5. The `ToastList` uses `Motion.View` as the animation wrapper with `initial: { opacity: 0 }` → `animate: { opacity: 1 }`. When the animation transition fails silently, the toast renders at `opacity: 0` — technically present in the DOM but invisible.
- **Fix Applied** (`components/ui/toast/index.tsx`):
  - Replaced `createToastHook(MotionView, AnimatePresence)` with `createToastHook(View, null)`.
  - Removed the `@legendapp/motion` imports entirely.
  - `View` ignores the animation props (`initial`, `animate`, `exit`, `transition`) harmlessly, rendering the toast at full opacity immediately.
  - Passing `null` for `AnimatePresence` causes `OverlayAnimatePresence` to fall back to `return children` (no wrapper), skipping the broken animation layer.
  - **Trade-off**: Toast appears/disappears instantly without fade animation. This can be restored later by upgrading `@legendapp/motion` to a React 19-compatible version or implementing a lightweight `Animated.View` wrapper.

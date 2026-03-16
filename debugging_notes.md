# Debugging Notes for Next Session

## 1. NativeWind Dark Mode Toggle Issue
- **State**: The app is not toggling between Light and Dark mode dynamically via physical system settings (Expo Go).
- **Current Implementation**: 
  - `tailwind.config.js` is set to `darkMode: 'class'`.
  - `app/_layout.tsx` is passing `mode={colorScheme}` into `GluestackUIProvider`.
  - Backgrounds use `className="bg-background-light dark:bg-background-dark"` and typography uses `dark:text-typography-x`.
- **Theory**: NativeWind cache in Expo Go often gets stuck. We need to do a hard shake-to-reload wipe on the device, or investigate if we should manually append the `.dark` class to the HTML root/RootView if `useColorScheme` is failing to pipe downward correctly in v4.

## 2. Gluestack UI Toast Not Firing
- **State**: Replaced inline React state errors (`error && <Text>{error}</Text>`) with `useToast()` on both the Login (`index.tsx`) and Register (`register.tsx`) pages. The user reports the toast message is *not appearing* when form validation fails.
- **Current Implementation**:
  - `useToast` hook is called.
  - `toast.show({ render: ({id}) => <Toast>... })` logic is inside the `handleLogin` and `handleRegister` functions.
  - The Root `_layout.tsx` has `<ToastProvider>` inside `<OverlayProvider>` under `<GluestackUIProvider>`.
- **Theory**: Gluestack Toast might require being wrapped in a specific Native View portal or the safe area context isn't calculating the absolute `"top"` placement properly, causing it to render invisibly off-screen. We need to test throwing a basic toast on mount to isolate the rendering issue.

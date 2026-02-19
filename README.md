# Defender

Tower-defense game prototype built with Expo and React Native.

## Development Build Workflow

This project is configured to use Expo development builds (`expo-dev-client`) instead of Expo Go.

1. Install dependencies

   ```bash
   npm install
   ```

2. Generate native projects (first time, and after native config changes)

   ```bash
   npm run prebuild
   ```

3. Build and run the development client

   ```bash
   npm run run:ios
   ```

   or

   ```bash
   npm run run:android
   ```

4. Start Metro for the dev client

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` starts Metro in dev-client mode.
- `npm run prebuild` regenerates native iOS/Android folders.
- `npm run run:ios` builds/runs the iOS development build.
- `npm run run:android` builds/runs the Android development build.
- `npm run lint` runs lint checks.

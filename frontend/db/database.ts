// Metro bundler automatically resolves:
// - database.web.ts on Web (Browser / Electron via React Native Web)
// - database.native.ts on Native (Android APK / iOS via expo-sqlite)
// This file acts as the unified type and fallback interface.
export * from './database.web';

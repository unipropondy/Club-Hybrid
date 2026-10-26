import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

declare const __DEV__: boolean;

const getLocalBackendIP = (): string => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.hostname;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(":")[0];
  }

  return "localhost";
};

export const localIP = getLocalBackendIP();

const calculateInitialUrl = (): string => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // When served via Metro bundler dev server (8081, 8082, 19006), Express backend is on port 5000
    if (window.location.port === "8081" || window.location.port === "8082" || window.location.port === "19006") {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
  }

  if (__DEV__) {
    return `http://${localIP}:5000`;
  }

  let envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    envUrl = envUrl.trim();
    if (!/^https?:\/\//i.test(envUrl)) {
      envUrl = `http://${envUrl}`;
    }
    return envUrl;
  }

  return "https://club-hybrid-production.up.railway.app";
};

export let API_URL: string = calculateInitialUrl();

export const getApiUrl = (): string => API_URL;

const urlListeners: Array<(url: string) => void> = [];

export const onApiUrlChange = (callback: (url: string) => void): (() => void) => {
  urlListeners.push(callback);
  return () => {
    const idx = urlListeners.indexOf(callback);
    if (idx !== -1) urlListeners.splice(idx, 1);
  };
};

export const setApiUrl = async (newUrl: string): Promise<string> => {
  let formatted = newUrl.trim();
  if (!/^https?:\/\//i.test(formatted)) {
    const isLocal = /^(\d+\.\d+\.\d+\.\d+|localhost)/i.test(formatted);
    formatted = isLocal ? `http://${formatted}` : `https://${formatted}`;
  }
  // Strip trailing slashes
  formatted = formatted.replace(/\/+$/, "");

  API_URL = formatted;
  try {
    await AsyncStorage.setItem("@server_custom_api_url", formatted);
  } catch (err) {
    console.warn("⚠️ Failed to persist custom API URL to AsyncStorage:", err);
  }

  urlListeners.forEach((fn) => {
    try {
      fn(formatted);
    } catch (e) {
      console.warn("⚠️ Error in onApiUrlChange listener:", e);
    }
  });

  console.log(`🔄 [Config] API_URL updated to: ${formatted}`);
  return formatted;
};

export const initApiUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem("@server_custom_api_url");
    if (saved && saved.trim()) {
      let formatted = saved.trim().replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(formatted)) {
        const isLocal = /^(\d+\.\d+\.\d+\.\d+|localhost)/i.test(formatted);
        formatted = isLocal ? `http://${formatted}` : `https://${formatted}`;
      }
      API_URL = formatted;
      urlListeners.forEach((fn) => fn(formatted));
      console.log(`🌐 [Config] Loaded custom API_URL from storage: ${formatted}`);
      return formatted;
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const confRes = await fetch("/api/config");
        if (confRes.ok) {
          const conf = await confRes.json();
          const activeBackend = conf?.backends?.find((b: any) => b.enabled);
          if (activeBackend?.url) {
            let formatted = activeBackend.url.trim().replace(/\/+$/, "");
            API_URL = formatted;
            urlListeners.forEach((fn) => fn(formatted));
            console.log(`🌐 [Config] Auto-detected backend API_URL from print-bridge: ${formatted}`);
            return formatted;
          }
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn("⚠️ Error loading custom API URL from storage:", e);
  }
  return API_URL;
};

// Immediate background initialization
initApiUrl();

if (__DEV__) {
  console.log(`🌐 [Config] Default API_URL: ${API_URL} | Platform: ${Platform.OS}`);
}

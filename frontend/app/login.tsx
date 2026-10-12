import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Fonts } from "@/constants/Fonts";
import { Theme } from "@/constants/theme";
import { API_URL, getApiUrl, setApiUrl, localIP, onApiUrlChange } from "@/constants/Config";
import { useAuthStore } from "@/stores/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ─────────────────────────────────────────────────────────────────────────────
   CSS SILK BLOB — organic morphing blob made with border-radius + gradient
   No image file needed. Looks like the Opticore fluid shape.
───────────────────────────────────────────────────────────────────────────── */
function SilkBlob({
  style,
  colors,
  delay = 0,
  size = 320,
}: {
  style?: any;
  colors: string[];
  delay?: number;
  size?: number;
}) {
  // Border-radius morph (simulates organic silk shape changing)
  const morph   = useRef(new Animated.Value(0)).current;
  const floatY  = useRef(new Animated.Value(0)).current;
  const floatX  = useRef(new Animated.Value(0)).current;
  const rotate  = useRef(new Animated.Value(0)).current;
  const scaleA  = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in smoothly
    Animated.timing(opacity, {
      toValue: 1, duration: 2000, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    // Float Y
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -28, duration: 5000, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 14,  duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0,   duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Float X (different period)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatX, { toValue: 14,  duration: 6500, delay: delay + 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatX, { toValue: -10, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatX, { toValue: 0,   duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Slow rotation
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1, duration: 28000, delay,
        easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();

    // Scale breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleA, { toValue: 1.12, duration: 5500, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scaleA, { toValue: 0.92, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scaleA, { toValue: 1.0,  duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // Static organic shape — web uses CSS clip-path, mobile uses borderRadius trick
  const half = size / 2;
  const blobStyle = Platform.OS === "web"
    ? {
        width: size, height: size,
        borderRadius: size,
        clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
      }
    : {
        width: size, height: size,
        borderTopLeftRadius: size * 0.60,
        borderTopRightRadius: size * 0.35,
        borderBottomRightRadius: size * 0.55,
        borderBottomLeftRadius: size * 0.40,
      };

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [
            { translateY: floatY },
            { translateX: floatX },
            { rotate: spin },
            { scale: scaleA },
          ],
        },
      ]}
    >
      {/* Outer glow layer */}
      <View
        style={{
          position: "absolute",
          width: size * 1.3,
          height: size * 1.3,
          top: -(size * 0.15),
          left: -(size * 0.15),
          borderRadius: size,
          backgroundColor: colors[0].replace(")", ", 0.15)").replace("rgb", "rgba"),
          opacity: 0.6,
        }}
      />

      {/* Main silk shape */}
      <LinearGradient
        colors={colors as any}
        start={{ x: 0.15, y: 0.0 }}
        end={{ x: 0.85, y: 1.0 }}
        style={[blobStyle, { overflow: "hidden" }]}
      >
        {/* Inner highlight streak — gives the silk sheen */}
        <LinearGradient
          colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0.05)", "transparent"]}
          start={{ x: 0.0, y: 0.0 }}
          end={{ x: 0.6, y: 0.7 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Second inner streak for iridescence */}
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.12)", "transparent"]}
          start={{ x: 0.4, y: 0.1 }}
          end={{ x: 1.0, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </LinearGradient>
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LOGIN SCREEN
───────────────────────────────────────────────────────────────────────────── */
export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(28)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const btnScale    = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTransY  = useRef(new Animated.Value(-14)).current;

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [userName, setUserName]         = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  // ── Server Connection Config Modal ──
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverHost, setServerHost]           = useState("");
  const [serverPort, setServerPort]           = useState("5000");
  const [pingStatus, setPingStatus]           = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [pingMessage, setPingMessage]         = useState("");
  const [currentUrlDisplay, setCurrentUrlDisplay] = useState(getApiUrl());

  useEffect(() => {
    const unsub = onApiUrlChange((newUrl) => setCurrentUrlDisplay(newUrl));
    return unsub;
  }, []);

  const openServerConfig = () => {
    try {
      const cur = getApiUrl().trim();
      const isHttps = cur.startsWith("https://");
      const noProto = cur.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      const [h, p] = noProto.split(":");
      setServerHost(h || "localhost");
      if (p) {
        setServerPort(p);
      } else if (h && (h.includes("railway.app") || isHttps)) {
        setServerPort("");
      } else {
        setServerPort("5000");
      }
    } catch (e) {
      setServerHost("192.168.0.236");
      setServerPort("5000");
    }
    setPingStatus("idle");
    setPingMessage("");
    setShowServerModal(true);
  };

  const buildServerUrl = (host: string, port: string): string => {
    let cleanHost = (host || "").trim();
    let cleanPort = (port || "").trim();

    if (!cleanHost) return "";

    // Strip trailing slashes
    cleanHost = cleanHost.replace(/\/+$/, "");

    // Extract protocol if explicitly given
    let protocol = "";
    if (/^https?:\/\//i.test(cleanHost)) {
      const protoMatch = cleanHost.match(/^(https?:\/\/)/i);
      if (protoMatch) {
        protocol = protoMatch[1].toLowerCase();
        cleanHost = cleanHost.substring(protocol.length);
      }
    }

    cleanHost = cleanHost.replace(/\/+$/, "");

    // Check if host contains an embedded port, e.g. "192.168.0.236:5000" or "app.railway.app:443"
    const hostPortMatch = cleanHost.match(/^([^:/]+):(\d+)$/);
    if (hostPortMatch) {
      cleanHost = hostPortMatch[1];
      if (!cleanPort) {
        cleanPort = hostPortMatch[2];
      }
    }

    const isIpOrLocal = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\d+\.\d+\.\d+\.\d+)$/i.test(cleanHost);
    const isRailway = cleanHost.toLowerCase().includes("railway.app");

    // Default protocol: Railway or cloud domain -> https://, local IP/localhost -> http://
    if (!protocol) {
      protocol = (isRailway || !isIpOrLocal) ? "https://" : "http://";
    }

    // Force https for Railway
    if (isRailway && protocol === "http://") {
      protocol = "https://";
    }

    // Handle port:
    // If port is left empty:
    // - Local IP / localhost defaults to 5000
    // - Railway / domain names have NO port appended (port left empty)
    if (!cleanPort) {
      if (isIpOrLocal) {
        cleanPort = "5000";
      }
    } else {
      // If Railway and port is 5000 (often lingering from local PC setting), 443, or 80, strip it
      if (isRailway && (cleanPort === "5000" || cleanPort === "443" || cleanPort === "80")) {
        cleanPort = "";
      } else if (protocol === "https://" && cleanPort === "443") {
        cleanPort = "";
      } else if (protocol === "http://" && cleanPort === "80") {
        cleanPort = "";
      }
    }

    if (cleanPort) {
      return `${protocol}${cleanHost}:${cleanPort}`;
    }
    return `${protocol}${cleanHost}`;
  };

  const handleTestConnection = async () => {
    if (!serverHost.trim()) return;
    setPingStatus("testing");
    setPingMessage("Testing connection to server...");
    const t0 = Date.now();
    try {
      const baseUrl = buildServerUrl(serverHost, serverPort);
      if (!baseUrl) {
        setPingStatus("failed");
        setPingMessage("Please enter a valid host or URL.");
        return;
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      let res = await fetch(`${baseUrl}/api/health`, { signal: ctrl.signal }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${baseUrl}/health`, { signal: ctrl.signal }).catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch(`${baseUrl}/api/terminal`, { signal: ctrl.signal }).catch(() => null);
      }
      clearTimeout(timer);
      if (res && res.ok) {
        const diff = Date.now() - t0;
        setPingStatus("success");
        setPingMessage(`Connected! Latency: ${diff}ms`);
      } else {
        setPingStatus("failed");
        setPingMessage(`Server unreachable or returned HTTP ${res?.status || "error"}`);
      }
    } catch (e: any) {
      setPingStatus("failed");
      setPingMessage("Unreachable. Check URL or Wi-Fi network.");
    }
  };

  const handleSaveServerConfig = async () => {
    const newUrl = buildServerUrl(serverHost, serverPort);
    if (!newUrl) {
      setPingStatus("failed");
      setPingMessage("Please enter a valid host or URL.");
      return;
    }
    await setApiUrl(newUrl);
    setCurrentUrlDisplay(newUrl);
    setShowServerModal(false);
  };

  useFocusEffect(
    useCallback(() => {
      const { user, loginDate, logout } = useAuthStore.getState();
      if (user) {
        const currentDate = new Date().toISOString().split("T")[0];
        if (loginDate && currentDate !== loginDate) {
          logout();
        } else {
          const uName = (user.userName || "").trim().toUpperCase();
          if (user.userGroupId === "DFCF23EE-F6F4-4885-8D26-0056C657595F") {
            router.replace("/sales-report");
          } else if (uName === "KDS") {
            router.replace("/kds" as any);
          } else {
            router.replace("/(tabs)/category");
          }
          return;
        }
      }

      setError("");
      setLoading(false);

      const loadRemembered = async () => {
        try {
          const saved = await AsyncStorage.getItem("remembered_creds");
          if (saved) {
            const { u, p } = JSON.parse(saved);
            setUserName(u || "");
            setPassword(p || "");
            setRememberMe(true);
          }
        } catch (e) {}
      };
      loadRemembered();

      // Staggered entrance
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(logoTransY, { toValue: 0, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(fadeAnim,  { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]).start();
    }, [fadeAnim, slideAnim, logoOpacity, logoTransY]),
  );

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const onBtnPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.95, tension: 220, friction: 16, useNativeDriver: true }).start();
  const onBtnPressOut = () =>
    Animated.spring(btnScale, { toValue: 1,    tension: 220, friction: 16, useNativeDriver: true }).start();

  const handleLogin = async () => {
    if (!userName.trim() || !password.trim()) {
      setError("Please enter both User ID and Password.");
      shakeError();
      return;
    }
    setLoading(true);
    setError("");
    const activeApi = getApiUrl();
    try {
      const response = await fetch(`${activeApi}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: userName.trim(), password }),
      });
      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user, data.token);
        try {
          if (rememberMe) {
            await AsyncStorage.setItem("remembered_creds", JSON.stringify({ u: userName.trim(), p: password }));
          } else {
            await AsyncStorage.removeItem("remembered_creds");
          }
        } catch (e) {}
        try {
          const permRes = await fetch(`${activeApi}/api/auth/permissions/${data.user.role}`);
          if (permRes.ok) {
            const permData = await permRes.json();
            setPermissions(permData);
          }
        } catch {
          setPermissions({});
        }
        const role = data.user.role;
        if (data.user.userGroupId === "DFCF23EE-F6F4-4885-8D26-0056C657595F") {
          router.replace("/sales-report");
        } else if (role === "KDS") {
          router.replace("/(tabs)/kds" as any);
        } else {
          router.replace("/(tabs)/category");
        }
      } else {
        setError(data.message || "Login failed. Please try again.");
        shakeError();
      }
    } catch (err: any) {
      setError("Cannot connect to Counter server. Check Wi-Fi & IP.");
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Base gradient ── */}
      <LinearGradient
        colors={["#08071A", "#0F083B", "#1A0840", "#08071A"]}
        locations={[0, 0.3, 0.68, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Background purple radial ambient ── */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      {/* ── SILK BLOB — top right (large, Opticore-style) ── */}
      <SilkBlob
        style={styles.blob1}
        size={340}
        colors={["#7C3AED", "#A855F7", "#C084FC", "#EC4899"]}
        delay={0}
      />

      {/* ── SILK BLOB — bottom left (medium echo) ── */}
      <SilkBlob
        style={styles.blob2}
        size={220}
        colors={["#4B1C71", "#7C3AED", "#9D4EDD"]}
        delay={800}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* ── Top Bar: Counter Server Connection Pill ── */}
        <View style={styles.topServerBar}>
          <TouchableOpacity
            style={styles.serverPill}
            onPress={openServerConfig}
            activeOpacity={0.8}
          >
            <View style={[styles.statusDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.serverPillText} numberOfLines={1}>
              {currentUrlDisplay.replace(/^https?:\/\//, "")}
            </Text>
            <Ionicons name="settings-outline" size={13} color="#C084FC" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, isLandscape && { paddingVertical: 10 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.centeredContent}>

              {/* ── Brand ── */}
              <Animated.View
                style={[
                  styles.brandRow,
                  isLandscape && { marginBottom: 16, flexDirection: "row", gap: 16, alignItems: "center" },
                  { opacity: logoOpacity, transform: [{ translateY: logoTransY }] },
                ]}
              >
                <View style={[styles.logoRing, isLandscape && { width: 60, height: 60, borderRadius: 18, marginBottom: 0 }]}>
                  <Image
                    source={require("../assets/images/logo_pos.png")}
                    style={{ width: isLandscape ? 40 : 56, height: isLandscape ? 40 : 56, borderRadius: 14 }}
                    resizeMode="contain"
                  />
                </View>
                <View style={isLandscape && { alignItems: "flex-start" }}>
                  <Text style={[styles.appName, isLandscape && { fontSize: 24 }]}>
                    <Text style={{ color: "#A855F7" }}>Smart</Text>
                    <Text style={{ color: "#F0EEFF" }}> Club</Text>
                  </Text>
                  <Text style={[styles.appTagline, isLandscape && { fontSize: 9 }]}>
                    VENUE MANAGEMENT SYSTEM
                  </Text>
                </View>
              </Animated.View>

              {/* ── Login card ── */}
              <Animated.View
                style={[
                  styles.card,
                  { transform: [{ translateX: shakeAnim }, { translateY: slideAnim }], opacity: fadeAnim },
                  isLandscape && { padding: 20 },
                ]}
              >

                <Text style={styles.cardTitle}>Welcome Back</Text>
                <Text style={styles.cardSub}>Sign in to manage your venue</Text>

                {error !== "" && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={15} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* User ID */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>USER ID</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="person-outline" size={18} color="#5A5080" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your User ID"
                      placeholderTextColor="#5A5080"
                      value={userName}
                      onChangeText={(t) => { setUserName(t); setError(""); }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={[styles.inputGroup, isLandscape && { marginBottom: 12 }]}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color="#5A5080" style={{ marginRight: 10 }} />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Enter your Password"
                      placeholderTextColor="#5A5080"
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(""); }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#5A5080"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Remember Me */}
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <Ionicons name="checkmark" size={13} color="#FFF" />}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </TouchableOpacity>

                {/* Sign In */}
                <Animated.View style={[styles.btnWrapper, { transform: [{ scale: btnScale }] }]}>
                  <TouchableOpacity
                    style={[styles.btn, loading && { opacity: 0.7 }]}
                    onPress={handleLogin}
                    onPressIn={onBtnPressIn}
                    onPressOut={onBtnPressOut}
                    disabled={loading}
                    activeOpacity={1}
                  >
                    <LinearGradient
                      colors={["#6D28D9", "#A855F7", "#C084FC"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="log-in-outline" size={20} color="#fff" />
                          <Text style={styles.btnText}>Sign In</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>

              <Text style={styles.footerText}>© 2026 Unipro Softwares SG Pte Ltd</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Server Connection Settings Modal ── */}
        <Modal
          visible={showServerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowServerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Ionicons name="server-outline" size={20} color="#C084FC" />
                  <Text style={styles.modalTitle}>Server Connection Setup</Text>
                </View>
                <TouchableOpacity onPress={() => setShowServerModal(false)}>
                  <Ionicons name="close-circle" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Connect to Railway Cloud Backend or Local Counter PC.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SERVER HOST OR RAILWAY URL</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="globe-outline" size={18} color="#5A5080" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. https://your-app.up.railway.app or 192.168.0.236"
                    placeholderTextColor="#5A5080"
                    value={serverHost}
                    onChangeText={(t) => { setServerHost(t); setPingStatus("idle"); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.modalHint}>
                  Paste Railway URL or Counter PC IP (leave port empty for Railway)
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>PORT (LEAVE EMPTY FOR RAILWAY)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="hardware-chip-outline" size={18} color="#5A5080" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Leave empty for Railway / 5000 for local PC"
                    placeholderTextColor="#5A5080"
                    value={serverPort}
                    onChangeText={(t) => { setServerPort(t); setPingStatus("idle"); }}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.modalHint}>
                  Can leave empty for Railway or standard cloud domains
                </Text>
              </View>

              {/* Ping / Test status */}
              {pingStatus !== "idle" && (
                <View style={[
                  styles.pingRow,
                  pingStatus === "success" && styles.pingSuccess,
                  pingStatus === "failed" && styles.pingFailed,
                ]}>
                  {pingStatus === "testing" ? (
                    <ActivityIndicator size="small" color="#A855F7" />
                  ) : (
                    <Ionicons
                      name={pingStatus === "success" ? "checkmark-circle" : "close-circle"}
                      size={18}
                      color={pingStatus === "success" ? "#10B981" : "#EF4444"}
                    />
                  )}
                  <Text style={[
                    styles.pingText,
                    pingStatus === "success" && { color: "#10B981" },
                    pingStatus === "failed" && { color: "#EF4444" },
                  ]}>
                    {pingMessage}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.testBtn}
                  onPress={handleTestConnection}
                  disabled={pingStatus === "testing"}
                >
                  <Text style={styles.testBtnText}>Test Connection</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveServerConfig}
                >
                  <LinearGradient
                    colors={["#7C3AED", "#A855F7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtnGradient}
                  >
                    <Text style={styles.saveBtnText}>Save & Apply</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#0A091A" },
  safeArea:     { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent:{ flexGrow: 1 },

  centeredContent: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 28,
  },

  // ── Static ambient glows (no image, no box) ──
  bgGlow1: {
    position: "absolute",
    width: 500, height: 500, borderRadius: 999,
    backgroundColor: "rgba(75,28,113,0.30)",
    top: -200, right: -180,
  },
  bgGlow2: {
    position: "absolute",
    width: 380, height: 380, borderRadius: 999,
    backgroundColor: "rgba(84,22,181,0.20)",
    bottom: -160, left: -140,
  },

  // ── CSS Silk Blobs — positioned ──
  blob1: {
    position: "absolute",
    top: -50,
    right: -100,
    zIndex: 0,
  },
  blob2: {
    position: "absolute",
    bottom: 30,
    left: -80,
    zIndex: 0,
  },

  // ── Brand ──
  brandRow: { alignItems: "center", marginBottom: 28, zIndex: 2 },
  logoRing: {
    width: 76, height: 76, borderRadius: 22, marginBottom: 12,
    backgroundColor: "#11102E",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "#3D3875",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  appName: { color: "#F0EEFF", fontSize: 28, fontFamily: Fonts.black, letterSpacing: 0.5 },
  appTagline: {
    color: "rgba(192,132,252,0.65)", fontSize: 10, fontFamily: Fonts.bold,
    letterSpacing: 1.5, marginTop: 4, textTransform: "uppercase",
  },

  // ── Card ──
  card: {
    width: "100%", maxWidth: 460,
    backgroundColor: "#11102E",
    borderRadius: 24, padding: 36,
    borderWidth: 1.5, borderColor: "#3D3875",
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
    zIndex: 2,
  },
  cardTopAccent: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 3, borderRadius: 2,
  },
  cardTitle: { color: "#F0EEFF", fontSize: 23, fontFamily: Fonts.black, marginTop: 6, marginBottom: 3 },
  cardSub:   { color: "rgba(155,142,196,0.80)", fontSize: 13, fontFamily: Fonts.medium, marginBottom: 26 },

  // ── Error ──
  errorRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 11,
    paddingHorizontal: 13, paddingVertical: 9, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.28)",
  },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: Fonts.medium, flex: 1 },

  // ── Inputs ──
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    color: "#9B8EC4", fontSize: 10, fontFamily: Fonts.bold,
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0A091A", borderRadius: 16,
    borderWidth: 1.5, borderColor: "#2E2A5E",
    paddingHorizontal: 16, height: 56,
  },
  input: {
    flex: 1, color: "#F0EEFF", fontSize: 15, fontFamily: Fonts.medium,
    ...Platform.select({ web: { outlineStyle: "none" } as any }),
  },

  // ── Remember Me ──
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24, paddingLeft: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 2,
    borderColor: "#2E2A5E", justifyContent: "center",
    alignItems: "center", backgroundColor: "#0A091A",
  },
  checkboxActive: { backgroundColor: Theme.primary, borderColor: Theme.primary },
  rememberText:   { fontSize: 15, fontFamily: Fonts.bold, color: "#9B8EC4" },

  // ── Sign In ──
  btnWrapper: { width: "100%" },
  btn: {
    height: 56, borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnGradient: {
    flex: 1, flexDirection: "row", justifyContent: "center",
    alignItems: "center", gap: 10,
  },
  btnText: { color: "#fff", fontSize: 18, fontFamily: Fonts.black, letterSpacing: 0.4 },

  footerText: {
    color: "rgba(90,80,128,0.70)", fontSize: 11,
    fontFamily: Fonts.medium, marginTop: 24, zIndex: 2,
  },

  // ── Top Server Bar & Pill ──
  topServerBar: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 10 : 4,
    alignItems: "flex-end",
    zIndex: 10,
  },
  serverPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(17,16,46,0.85)",
    borderWidth: 1,
    borderColor: "#3D3875",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  serverPillText: {
    color: "#C084FC",
    fontSize: 12,
    fontFamily: Fonts.bold,
    maxWidth: 180,
  },

  // ── Server Setup Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#11102E",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#3D3875",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: "#F0EEFF",
    fontSize: 18,
    fontFamily: Fonts.black,
  },
  modalSubtitle: {
    color: "rgba(155,142,196,0.85)",
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginBottom: 20,
    lineHeight: 18,
  },
  modalHint: {
    color: "rgba(155,142,196,0.6)",
    fontSize: 10,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  pingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 16,
  },
  pingSuccess: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
  },
  pingFailed: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  pingText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    flex: 1,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  testBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4B4480",
    backgroundColor: "#1A1744",
    justifyContent: "center",
    alignItems: "center",
  },
  testBtnText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveBtnGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Fonts.black,
  },
});

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import apiClient from "@/api/client";
import { store } from "@/utils";

export default function AdminOtp() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => setEmail(await store.get("auth_email")))();
  }, []);

  useEffect(() => {
    let interval: any;
    if (cooldown > 0) {
      interval = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => interval && clearInterval(interval);
  }, [cooldown]);

  const isOtpValid = useMemo(() => otp.trim().length === 4, [otp]);

  const handleVerify = async () => {
    if (!email) {
      Alert.alert("Missing email", "Please go back and enter your email.");
      router.replace("/(auth)");
      return;
    }
    if (!isOtpValid || verifying) return;
    try {
      setVerifying(true);
      const payload = { email, otp: otp.trim() };
      const response = await apiClient.post("/api/user/verify-otp", payload);
      const data = response?.data as any;
      console.log("Verify response:", data);
      if (data?.success && data?.token) {
        await store.set("token", data.token);
        if (data?.role) {
          await store.set("role", String(data.role));
        }
        await store.delete("auth_email");

        if (data?.role === "admin") {
          router.replace("/(admin)");
        } else {
          router.replace("/not-allowed" as any);
        }
      } else {
        Alert.alert("Error", data?.message || "Verification failed");
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to verify OTP";
      Alert.alert("Error", message);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || resending || cooldown > 0) return;
    try {
      setResending(true);
      // Trigger a re-login to resend OTP for unverified accounts
      Alert.alert("Info", "Please go back and log in again. A verification code will be sent if needed.");
      setCooldown(30);
    } catch (error: any) {
      const message = error?.response?.data?.message || "Failed to resend OTP";
      Alert.alert("Error", message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify Email</Text>
        <Text style={styles.subtitle}>We sent a 4-digit code to {email || "your email"}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Verification Code</Text>
          <TextInput value={otp} onChangeText={setOtp} placeholder="____" keyboardType="number-pad" style={styles.input} maxLength={4} placeholderTextColor="#9ca3af" />
        </View>

        <TouchableOpacity onPress={handleVerify} activeOpacity={0.8} style={[styles.button, (!isOtpValid || verifying) && styles.buttonDisabled]} disabled={!isOtpValid || verifying}>
          {verifying ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive the code?</Text>
          <TouchableOpacity onPress={handleResend} disabled={resending || cooldown > 0}>
            <Text style={[styles.resendLink, (resending || cooldown > 0) && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Resending..." : "Resend"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  card: { width: "100%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { fontSize: 28, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#6b7280" },
  inputGroup: { marginTop: 24 },
  label: { fontSize: 14, color: "#374151", marginBottom: 8 },
  input: { height: 48, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#111827", letterSpacing: 12, textAlign: "center", fontSize: 20, fontWeight: "600" },
  button: { marginTop: 20, height: 48, borderRadius: 10, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  buttonDisabled: { backgroundColor: "#93c5fd" },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  resendRow: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  resendText: { color: "#6b7280", marginRight: 6 },
  resendLink: { color: "#2563eb", fontWeight: "600" },
  resendDisabled: { color: "#93c5fd" },
});

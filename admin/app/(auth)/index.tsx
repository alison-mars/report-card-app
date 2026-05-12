import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import apiClient from "@/api/client";
import { useRouter } from "expo-router";
import { store } from "@/utils";

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPassword = password.length >= 6;
  const canSubmit = isValidEmail && isValidPassword && !submitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const payload = { email: email.trim().toLowerCase(), password };
      const response = await apiClient.post("/api/user/login", payload);
      const data = response?.data as any;
      if (data?.success && data?.token) {
        await store.set("token", data.token);
        if (data?.role) {
          await store.set("role", String(data.role));
        }
        if (data?.role === "admin") {
          router.replace("/(admin)");
        } else {
          Alert.alert("Access Denied", "You must be an admin to use this panel.");
        }
      } else if (data?.requiresVerification) {
        await store.set("auth_email", email.trim().toLowerCase());
        router.replace("/(auth)/otp");
      } else {
        Alert.alert("Error", data?.message || "Login failed");
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Login failed";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Admin Login</Text>
        <Text style={styles.subtitle}>Sign in with your email and password</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            textContentType="password"
            style={styles.input}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <TouchableOpacity onPress={handleLogin} activeOpacity={0.8} style={[styles.button, !canSubmit && styles.buttonDisabled]} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  card: { width: "100%", backgroundColor: "#ffffff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { fontSize: 28, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#6b7280" },
  inputGroup: { marginTop: 20 },
  label: { fontSize: 14, color: "#374151", marginBottom: 8 },
  input: { height: 48, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, backgroundColor: "#ffffff", color: "#111827" },
  button: { marginTop: 20, height: 48, borderRadius: 10, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  buttonDisabled: { backgroundColor: "#93c5fd" },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
});

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import apiClient from "@/api/client";
import type { RegisterResponse, LoginResponse } from "@/types/api";
import { useRouter } from "expo-router";
import { useAuthStore, type AuthUser } from "@/store/auth";
import { store } from "@/utils";

export type UserRole = "student" | "teacher";

export default function Auth() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const setEmailInStore = useAuthStore((s) => s.setEmail);
  const setUserIdInStore = useAuthStore((s) => s.setUserId);
  const setSelectedRoleInStore = useAuthStore((s) => s.setSelectedRole);
  const setUser = useAuthStore((s) => s.setUser);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPassword = password.length >= 6;
  const canSubmit = isValidEmail && isValidPassword && !submitting;

  // ── Register ──
  const handleRegister = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const payload = { email: email.trim().toLowerCase(), password, role: selectedRole };
      const response = await apiClient.post<RegisterResponse>("/api/user/register", payload);
      if (response?.data.success) {
        setEmailInStore(payload.email);
        setSelectedRoleInStore(selectedRole);
        if (response?.data.userId) setUserIdInStore(response.data.userId);
        router.replace("/auth/Otp");
      } else {
        Alert.alert("Error", response?.data.message || "Registration failed");
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Registration failed";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Login ──
  const handleLogin = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const payload = { email: email.trim().toLowerCase(), password };
      const response = await apiClient.post<LoginResponse>("/api/user/login", payload);
      if (response?.data.success && response?.data.token) {
        await store.set("token", response.data.token);
        if (response?.data.user) {
          setUser(response.data.user as AuthUser);
        }
        const userRole = response?.data.role || response?.data.user?.role || "student";
        await store.set("role", userRole);
        router.replace("/");
      } else if (response?.data.requiresVerification) {
        // Email not verified — redirect to OTP screen
        setEmailInStore(email.trim().toLowerCase());
        if (response?.data.userId) setUserIdInStore(response.data.userId);
        Alert.alert("Verify Email", response?.data.message || "Please verify your email.");
        router.replace("/auth/Otp");
      } else {
        Alert.alert("Error", response?.data.message || "Login failed");
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || "Login failed";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = isLoginMode ? handleLogin : handleRegister;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            {isLoginMode ? "Log in to your account" : "Create a new account"}
          </Text>

          {/* Register-only: Role Selection */}
          {!isLoginMode && (
            <View style={styles.roleSection}>
              <Text style={styles.roleLabel}>I am a</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleCard, selectedRole === "student" && styles.roleCardActive]}
                  onPress={() => setSelectedRole("student")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.roleEmoji}>🎓</Text>
                  <Text style={[styles.roleText, selectedRole === "student" && styles.roleTextActive]}>
                    Student
                  </Text>
                  <Text style={[styles.roleDesc, selectedRole === "student" && styles.roleDescActive]}>
                    Take tests & track progress
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleCard, selectedRole === "teacher" && styles.roleCardActive]}
                  onPress={() => setSelectedRole("teacher")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.roleEmoji}>📚</Text>
                  <Text style={[styles.roleText, selectedRole === "teacher" && styles.roleTextActive]}>
                    Teacher
                  </Text>
                  <Text style={[styles.roleDesc, selectedRole === "teacher" && styles.roleDescActive]}>
                    Create classrooms & assign tests
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={isLoginMode ? "Enter your password" : "Create a password (min 6 chars)"}
              secureTextEntry
              textContentType={isLoginMode ? "password" : "newPassword"}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.8}
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLoginMode ? "Log In" : "Register"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle Login / Register */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            </Text>
            <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
              <Text style={styles.toggleLink}>
                {isLoginMode ? "Register" : "Log In"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  roleSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  roleLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: "row",
    gap: 12,
  },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  roleCardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  roleEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  roleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  roleTextActive: {
    color: "#2563eb",
  },
  roleDesc: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
  },
  roleDescActive: {
    color: "#3b82f6",
  },
  inputGroup: {
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  button: {
    marginTop: 20,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  toggleRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: {
    color: "#6b7280",
    marginRight: 6,
  },
  toggleLink: {
    color: "#2563eb",
    fontWeight: "600",
  },
});

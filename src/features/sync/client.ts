import "./polyfill";
import { createClient, processLock } from "@supabase/supabase-js";
import { Platform } from "react-native";
import sessionStorage from "./sessionStorage";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const permittedUrl = (value: string) => {
  try { const parsed = new URL(value); return parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)); } catch { return false; }
};
export const cloud = url && key && permittedUrl(url) ? createClient(url, key, { auth: {
  storage: sessionStorage, persistSession: true, autoRefreshToken: true,
  detectSessionInUrl: Platform.OS === "web", flowType: "pkce", lock: processLock,
} }) : null;
export const cloudEndpoint = url ?? "";
export const cloudRecoveryRedirect = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : undefined;

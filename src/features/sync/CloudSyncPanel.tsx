import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { Button, Card, Input } from "../../components/common";
import type { useAppModel } from "../../hooks/useAppModel";
import type { AppData } from "../../types";
import { contentHash } from "../../domain/contentHash";
import { downloadText } from "../../platform/fileAccess";
import { cloud } from "./client";
import { synchronize, SyncConflictError } from "./synchronize";
import type { SyncConflict, SyncResolution } from "./syncPlan";

export function CloudSyncPanel({ data, actions }: { data: AppData; actions: ReturnType<typeof useAppModel>["actions"] }) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [adopt, setAdopt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, SyncResolution>>({});
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    cloud.auth.getSession().then(({ data, error }) => { if (active) { setUser(data.session?.user ?? null); if (error) setMessage(error.message); } }).catch(() => { if (active) setMessage("Could not restore your sign-in session."); });
    const { data: listener } = cloud.auth.onAuthStateChange((_event, session) => { if (active) setUser(session?.user ?? null); });
    const appState = AppState.addEventListener("change", state => { if (state === "active") cloud?.auth.startAutoRefresh(); else cloud?.auth.stopAutoRefresh(); });
    return () => { active = false; listener.subscription.unsubscribe(); appState.remove(); };
  }, []);
  useEffect(() => { setAdopt(false); setConflicts([]); setResolutions({}); }, [user?.id]);
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await task(); } catch (error) {
      if (error instanceof SyncConflictError) setConflicts(error.conflicts);
      setMessage(error instanceof Error ? error.message : "Cloud request failed. Local data is preserved.");
    } finally { setBusy(false); }
  };
  return <Card><View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>Optional cloud sync · pilot</Text>
    {!cloud ? <Text style={styles.body}>Cloud sync is not configured for this build. Your complete local workspace and backups work without an account.</Text> : user ? <>
      <Text selectable style={styles.body}>Signed in as {user.email ?? user.id}. Sync includes your notes, recipes and evaluation history. Price archives stay on this device. Sync runs when you press the button.</Text>
      <Button label={adopt ? "Confirmed: this workspace belongs to this account" : "Confirm this workspace belongs to my account"} tone="secondary" disabled={busy} onPress={() => setAdopt(value => !value)} />
      {conflicts.map(conflict => <View key={conflict.key} style={styles.conflict}>
        <Text accessibilityRole="header" style={styles.body}>{conflict.key}</Text>
        <Text selectable style={styles.detail}>This device: {JSON.stringify(conflict.local?.payload ?? "Deleted")}</Text>
        <Text selectable style={styles.detail}>Cloud: {JSON.stringify(conflict.remote?.deleted ? "Deleted" : conflict.remote?.payload ?? "Deleted")}</Text>
        <Button label={resolutions[conflict.key]?.choice === "local" ? "Selected: keep this device" : "Keep this device's version"} tone="secondary" disabled={busy} onPress={() => setResolutions(previous => ({ ...previous, [conflict.key]: { choice: "local", localHash: conflict.localHash, remoteHash: conflict.remoteHash } }))} />
        <Button label={resolutions[conflict.key]?.choice === "remote" ? "Selected: keep cloud" : "Keep the cloud version"} tone="secondary" disabled={busy} onPress={() => setResolutions(previous => ({ ...previous, [conflict.key]: { choice: "remote", localHash: conflict.localHash, remoteHash: conflict.remoteHash } }))} />
      </View>)}
      <Button label={busy ? "Working…" : conflicts.length ? "Back up and apply selected resolutions" : "Sync now"} disabled={busy || conflicts.some(conflict => !resolutions[conflict.key])} onPress={() => run(async () => {
        if (conflicts.length) await downloadText("StockLedger-before-sync.json", actions.exportBackup());
        const hash = contentHash(data);
        const result = await synchronize(data, adopt, next => actions.applyCloudData(hash, next), resolutions);
        setConflicts([]); setResolutions({}); setMessage(`Synced ${result.records} cloud records; uploaded ${result.uploaded} changes.`);
      })} />
      <Button label="Sign out and keep local data" tone="ghost" disabled={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signOut({ scope: "local" }); if (error) throw error; setMessage("Signed out. The workspace remains on this device."); })} />
    </> : <>
      <Text style={styles.body}>Sign in to an existing account or create one. Local data is uploaded only when you choose Sync now.</Text>
      <Input placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
      <Button label="Sign in" disabled={busy || !email.trim() || !password} onPress={() => run(async () => { const { error } = await cloud!.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; setPassword(""); })} />
      <Button label="Create account" tone="secondary" disabled={busy || !email.trim() || password.length < 12} onPress={() => run(async () => { const { error } = await cloud!.auth.signUp({ email: email.trim(), password }); if (error) throw error; setPassword(""); setMessage("Account request submitted. Check your email if confirmation is required, then sign in."); })} />
      <Text style={styles.body}>New passwords need at least 12 characters.</Text>
    </>}
    {message ? <Text accessibilityLiveRegion="polite" selectable style={styles.body}>{message}</Text> : null}
  </View></Card>;
}
const styles = StyleSheet.create({ panel: { padding: 16, gap: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#15283b" }, body: { fontSize: 15, lineHeight: 23, color: "#334b62" }, detail: { fontSize: 12, lineHeight: 18, color: "#334b62" }, conflict: { gap: 10, borderWidth: 1, borderColor: "#c7d2df", padding: 12, borderRadius: 12 } });

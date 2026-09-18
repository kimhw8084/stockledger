import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { Button, Card, Input } from "../../components/common";
import type { useAppModel } from "../../hooks/useAppModel";
import type { AppData } from "../../types";
import { contentHash } from "../../domain/contentHash";
import { downloadText } from "../../platform/fileAccess";
import { formatLocaleDateTime, t, type AppLanguage } from "../../lib/i18n";
import { cloud, cloudRecoveryRedirect } from "./client";
import {
  exportPersonalCloudData,
  getAccountDeletionStatus,
  requestAccountDeletion,
  synchronize,
  SyncConflictError,
  SyncCursorExpiredError,
  type AccountDeletionStatus,
} from "./synchronize";
import type { SyncConflict, SyncResolution } from "./syncPlan";

export function CloudSyncPanel({ data, actions, language }: { data: AppData; actions: ReturnType<typeof useAppModel>["actions"]; language: AppLanguage }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [adopt, setAdopt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, SyncResolution>>({});
  const [rebootstrapRequired, setRebootstrapRequired] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<{ status: AccountDeletionStatus; requestedAt: string; startedAt?: string | null; completedAt?: string | null; failedAt?: string | null; failureCode?: string | null; authUserDeletion?: "unproven" | "completed" } | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (!cloud) return;
    const client = cloud;
    let active = true;
    const restore = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const status = sessionData.session ? await getAccountDeletionStatus() : null;
      if (!active) return;
      setUser(sessionData.session?.user ?? null);
      setSessionExpiresAt(sessionData.session?.expires_at ?? null);
      setDeletionStatus(status);
      if (sessionError) setMessage(sessionError.message);
    };
    restore().catch(() => { if (active) setMessage(t(language, "cloud.sessionRestoreFailed")); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setSessionExpiresAt(session?.expires_at ?? null);
      if (!session) { setDeletionStatus(null); setPassword(""); setNewPassword(""); setConfirmPassword(""); }
    });
    const appState = AppState.addEventListener("change", state => { if (state === "active") client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); });
    return () => { active = false; listener.subscription.unsubscribe(); appState.remove(); };
  }, [language]);

  useEffect(() => { setAdopt(false); setConflicts([]); setResolutions({}); setRebootstrapRequired(false); setDeleteArmed(false); }, [user?.id]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await task(); } catch (error) {
      if (error instanceof SyncConflictError) { setConflicts(error.conflicts); setRebootstrapRequired(false); }
      if (error instanceof SyncCursorExpiredError) setRebootstrapRequired(true);
      setMessage(error instanceof Error ? error.message : t(language, "cloud.requestFailed"));
    } finally { setBusy(false); }
  };

  const statusLabel = deletionStatus ? t(language, `cloud.deletion.${deletionStatus.status}`) : null;
  const cloudDisabled = deletionStatus?.status === "requested" || deletionStatus?.status === "in_progress" || deletionStatus?.status === "completed";

  return <Card><View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>{t(language, "cloud.title")}</Text>
    {!cloud ? <Text style={styles.body}>{t(language, "cloud.notConfigured")}</Text> : user ? <>
      <Text selectable style={styles.body}>{t(language, "cloud.signedInAs", { account: user.email ?? t(language, "cloud.accountPrivate") })}</Text>
      <Text style={styles.detail}>{t(language, "cloud.deviceSessionActive")}{sessionExpiresAt ? ` · ${t(language, "cloud.sessionExpires", { date: formatLocaleDateTime(language, new Date(sessionExpiresAt * 1000).toISOString()) })}` : ""}</Text>
      <Text style={styles.body}>{t(language, "cloud.syncIncludes")}</Text>
      {statusLabel ? <View accessibilityLiveRegion="polite" style={styles.status}><Text style={styles.body}>{t(language, "cloud.deletionStatus", { status: statusLabel })}</Text><Text style={styles.detail}>{deletionStatus?.authUserDeletion === "completed" ? t(language, "cloud.authDeletionCompleted") : t(language, "cloud.authDeletionUnproven")}</Text></View> : null}
      {!cloudDisabled ? <>
        <Button label={adopt ? t(language, "cloud.adoptionConfirmed") : t(language, "cloud.confirmAdoption")} tone="secondary" disabled={busy} onPress={() => setAdopt(value => !value)} />
        {conflicts.map(conflict => <View key={conflict.key} style={styles.conflict}>
          <Text accessibilityRole="header" style={styles.body}>{conflict.key}</Text>
          <Text style={styles.detail}>{t(language, "cloud.localVersion", { state: conflict.local?.deleted ? t(language, "cloud.deleted") : t(language, "cloud.edited") })}</Text>
          <Text style={styles.detail}>{t(language, "cloud.remoteVersion", { state: conflict.remote?.deleted ? t(language, "cloud.deleted") : t(language, "cloud.edited"), revision: conflict.remoteRevision, cursor: conflict.cursor })}</Text>
          <Button label={resolutions[conflict.key]?.choice === "local" ? t(language, "cloud.selectedLocal") : t(language, "cloud.keepLocal")} tone="secondary" disabled={busy} onPress={() => setResolutions(previous => ({ ...previous, [conflict.key]: { choice: "local", localHash: conflict.localHash, remoteHash: conflict.remoteHash, remoteRevision: conflict.remoteRevision, cursor: conflict.cursor } }))} />
          <Button label={resolutions[conflict.key]?.choice === "remote" ? t(language, "cloud.selectedRemote") : t(language, "cloud.keepRemote")} tone="secondary" disabled={busy} onPress={() => setResolutions(previous => ({ ...previous, [conflict.key]: { choice: "remote", localHash: conflict.localHash, remoteHash: conflict.remoteHash, remoteRevision: conflict.remoteRevision, cursor: conflict.cursor } }))} />
        </View>)}
        {rebootstrapRequired ? <View style={styles.status}><Text style={styles.body}>{t(language, "cloud.cursorExpired")}</Text><Text style={styles.detail}>{t(language, "cloud.rebootstrapBody")}</Text></View> : null}
        <Button label={busy ? t(language, "cloud.working") : rebootstrapRequired ? t(language, "cloud.rebootstrap") : conflicts.length ? t(language, "cloud.backupAndApply") : t(language, "cloud.syncNow")} disabled={busy || (!rebootstrapRequired && conflicts.some(conflict => !resolutions[conflict.key]))} onPress={() => run(async () => {
          if (conflicts.length) await downloadText("StockLedger-before-sync.json", actions.exportBackup());
          const result = await synchronize(data, adopt, next => actions.applyCloudData(contentHash(data), next), resolutions, { allowRebootstrap: rebootstrapRequired });
          setConflicts([]); setResolutions({}); setRebootstrapRequired(false); setMessage(t(language, "cloud.syncComplete", { records: result.records, uploaded: result.uploaded }));
        })} />
      </> : null}
      <View style={styles.divider} />
      <Button label={t(language, "cloud.exportCloud")} tone="secondary" disabled={busy} onPress={() => run(async () => { await downloadText("StockLedger-cloud-export.json", await exportPersonalCloudData()); setMessage(t(language, "cloud.exported")); })} />
      <Button label={t(language, "cloud.signOutLocal")} tone="ghost" disabled={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signOut({ scope: "local" }); if (error) throw error; setMessage(t(language, "cloud.signedOutLocal")); })} />
      <Button label={t(language, "cloud.signOutGlobal")} tone="ghost" disabled={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signOut({ scope: "global" }); if (error) throw error; setMessage(t(language, "cloud.signedOutGlobal")); })} />
      <Input placeholder={t(language, "cloud.newPassword")} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <Input placeholder={t(language, "cloud.confirmPassword")} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <Button label={t(language, "cloud.updatePassword")} tone="secondary" disabled={busy || newPassword.length < 12 || newPassword !== confirmPassword} onPress={() => run(async () => { const { error } = await cloud!.auth.updateUser({ password: newPassword }); if (error) throw error; setNewPassword(""); setConfirmPassword(""); setMessage(t(language, "cloud.passwordUpdated")); })} />
      <Text style={styles.detail}>{t(language, "cloud.externalBackupLimit")}</Text>
      {!deletionStatus || deletionStatus.status === "failed" ? <>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{t(language, "cloud.deleteTitle")}</Text>
        <Text style={styles.body}>{t(language, "cloud.deleteBody")}</Text>
        <Button label={deleteArmed ? t(language, "cloud.confirmDelete") : t(language, "cloud.requestDelete")} tone="risk" disabled={busy} onPress={() => { if (!deleteArmed) { setDeleteArmed(true); return; } void run(async () => { const status = await requestAccountDeletion(); setDeletionStatus(status); setDeleteArmed(false); setMessage(t(language, "cloud.deleteRequested")); }); }} />
      </> : null}
    </> : <>
      <Text style={styles.body}>{t(language, "cloud.signInBody")}</Text>
      <Input placeholder={t(language, "cloud.emailPlaceholder")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Input placeholder={t(language, "cloud.passwordPlaceholder")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
      <Button label={t(language, "cloud.signIn")} disabled={busy || !email.trim() || !password} onPress={() => run(async () => { const { error } = await cloud!.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; setPassword(""); })} />
      <Button label={t(language, "cloud.createAccount")} tone="secondary" disabled={busy || !email.trim() || password.length < 12} onPress={() => run(async () => { const { error } = await cloud!.auth.signUp({ email: email.trim(), password }); if (error) throw error; setPassword(""); setMessage(t(language, "cloud.accountSubmitted")); })} />
      <Button label={t(language, "cloud.sendRecovery")} tone="ghost" disabled={busy || !email.trim()} onPress={() => run(async () => { const { error } = await cloud!.auth.resetPasswordForEmail(email.trim(), cloudRecoveryRedirect ? { redirectTo: cloudRecoveryRedirect } : undefined); if (error) throw error; setMessage(t(language, "cloud.recoverySent")); })} />
      <Text style={styles.body}>{t(language, "cloud.passwordRule")}</Text>
    </>}
    {message ? <Text accessibilityLiveRegion="polite" selectable style={styles.body}>{message}</Text> : null}
  </View></Card>;
}

const styles = StyleSheet.create({ panel: { padding: 16, gap: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#15283b" }, sectionTitle: { fontSize: 18, fontWeight: "700", color: "#15283b" }, body: { fontSize: 15, lineHeight: 23, color: "#334b62" }, detail: { fontSize: 12, lineHeight: 18, color: "#334b62" }, conflict: { gap: 10, borderWidth: 1, borderColor: "#c7d2df", padding: 12, borderRadius: 12 }, status: { gap: 4, borderWidth: 1, borderColor: "#c7d2df", padding: 12, borderRadius: 12 }, divider: { height: 1, backgroundColor: "#dbe3eb", marginVertical: 4 } });

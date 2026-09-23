import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { User } from "@supabase/supabase-js";
import type { AppLanguage } from "../../lib/preferences";
import { AlertBanner, Button, Card, StatusIndicator, StyleSheet, Text, VStack, View } from "../../ui";
import type { useAppModel } from "../../hooks/useAppModel";
import type { AppData } from "../../types";
import { contentHash } from "../../domain/contentHash";
import { downloadText } from "../../platform/fileAccess";
import { formatLocaleDateTime, t } from "../../lib/i18n";
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
import { FormField } from "../settings/FormField";

export function CloudSyncPanel({ data, actions, language }: { data: AppData; actions: ReturnType<typeof useAppModel>["actions"]; language: AppLanguage }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
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
      if (sessionError) setErrorMessage(sessionError.message);
    };
    restore().catch(() => { if (active) setErrorMessage(t(language, "cloud.sessionRestoreFailed")); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setSessionExpiresAt(session?.expires_at ?? null);
      if (!session) { setDeletionStatus(null); setPassword(""); setNewPassword(""); setConfirmPassword(""); }
    });
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); });
    return () => { active = false; listener.subscription.unsubscribe(); appState.remove(); };
  }, [language]);

  useEffect(() => { setAdopt(false); setConflicts([]); setResolutions({}); setRebootstrapRequired(false); setDeleteArmed(false); }, [user?.id]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    setErrorMessage("");
    try {
      await task();
    } catch (cause) {
      if (cause instanceof SyncConflictError) { setConflicts(cause.conflicts); setRebootstrapRequired(false); }
      if (cause instanceof SyncCursorExpiredError) setRebootstrapRequired(true);
      setErrorMessage(cause instanceof Error ? cause.message : t(language, "cloud.requestFailed"));
    } finally {
      setBusy(false);
    }
  };

  const deletionLabel = deletionStatus ? t(language, `cloud.deletion.${deletionStatus.status}`) : null;
  const cloudDisabled = deletionStatus?.status === "requested" || deletionStatus?.status === "in_progress" || deletionStatus?.status === "completed";

  return (
    <Card variant="subtle">
      <VStack gap="lg">
        <View style={styles.heading}>
          <View style={styles.copy}>
            <Text variant="h3">{t(language, "cloud.title")}</Text>
            <Text tone="secondary">{t(language, "cloud.syncIncludes")}</Text>
          </View>
          <StatusIndicator
            label={!cloud ? (language === "ko" ? "미설정" : "Not configured") : user ? (language === "ko" ? "로그인됨" : "Signed in") : (language === "ko" ? "로그아웃" : "Signed out")}
            description={!cloud ? t(language, "cloud.notConfigured") : user ? t(language, "cloud.deviceSessionActive") : t(language, "cloud.signInBody")}
            tone={!cloud ? "warning" : user ? "info" : "neutral"}
          />
        </View>

        {!cloud ? null : user ? (
          <VStack gap="md">
            <Text selectable>{t(language, "cloud.signedInAs", { account: user.email ?? t(language, "cloud.accountPrivate") })}</Text>
            <Text variant="caption" tone="secondary">{t(language, "cloud.deviceSessionActive")}{sessionExpiresAt ? ` · ${t(language, "cloud.sessionExpires", { date: formatLocaleDateTime(language, new Date(sessionExpiresAt * 1000).toISOString()) })}` : ""}</Text>
            {deletionLabel ? (
              <AlertBanner
                tone={deletionStatus?.status === "failed" ? "warning" : "info"}
                title={t(language, "cloud.deletionStatus", { status: deletionLabel })}
                message={deletionStatus?.authUserDeletion === "completed" ? t(language, "cloud.authDeletionCompleted") : t(language, "cloud.authDeletionUnproven")}
              />
            ) : null}
            {!cloudDisabled ? (
              <VStack gap="md">
                <Button label={adopt ? t(language, "cloud.adoptionConfirmed") : t(language, "cloud.confirmAdoption")} variant="secondary" disabled={busy} onPress={() => setAdopt((value) => !value)} responsiveWidth="compact-full" />
                {conflicts.map((conflict) => (
                  <Card key={conflict.key} variant="elevated" padding="compact">
                    <VStack gap="sm">
                      <Text variant="label">{conflict.key}</Text>
                      <Text variant="caption" tone="secondary">{t(language, "cloud.localVersion", { state: conflict.local?.deleted ? t(language, "cloud.deleted") : t(language, "cloud.edited") })}</Text>
                      <Text variant="caption" tone="secondary">{t(language, "cloud.remoteVersion", { state: conflict.remote?.deleted ? t(language, "cloud.deleted") : t(language, "cloud.edited"), revision: conflict.remoteRevision, cursor: conflict.cursor })}</Text>
                      <View style={styles.actions}>
                        <Button label={resolutions[conflict.key]?.choice === "local" ? t(language, "cloud.selectedLocal") : t(language, "cloud.keepLocal")} variant="secondary" disabled={busy} onPress={() => setResolutions((previous) => ({ ...previous, [conflict.key]: { choice: "local", localHash: conflict.localHash, remoteHash: conflict.remoteHash, remoteRevision: conflict.remoteRevision, cursor: conflict.cursor } }))} responsiveWidth="compact-full" />
                        <Button label={resolutions[conflict.key]?.choice === "remote" ? t(language, "cloud.selectedRemote") : t(language, "cloud.keepRemote")} variant="secondary" disabled={busy} onPress={() => setResolutions((previous) => ({ ...previous, [conflict.key]: { choice: "remote", localHash: conflict.localHash, remoteHash: conflict.remoteHash, remoteRevision: conflict.remoteRevision, cursor: conflict.cursor } }))} responsiveWidth="compact-full" />
                      </View>
                    </VStack>
                  </Card>
                ))}
                {rebootstrapRequired ? <AlertBanner tone="warning" title={t(language, "cloud.cursorExpired")} message={t(language, "cloud.rebootstrapBody")} /> : null}
                <Button
                  label={busy ? t(language, "cloud.working") : rebootstrapRequired ? t(language, "cloud.rebootstrap") : conflicts.length ? t(language, "cloud.backupAndApply") : t(language, "cloud.syncNow")}
                  disabled={busy || (!rebootstrapRequired && conflicts.some((conflict) => !resolutions[conflict.key]))}
                  loading={busy}
                  onPress={() => run(async () => {
                    if (conflicts.length) await downloadText("StockLedger-before-sync.json", actions.exportBackup());
                    const result = await synchronize(data, adopt, (next) => actions.applyCloudData(contentHash(data), next), resolutions, { allowRebootstrap: rebootstrapRequired });
                    setConflicts([]); setResolutions({}); setRebootstrapRequired(false);
                    setMessage(t(language, "cloud.syncComplete", { records: result.records, uploaded: result.uploaded }));
                  })}
                  responsiveWidth="compact-full"
                />
              </VStack>
            ) : null}
            <View style={styles.divider} />
            <View style={styles.actions}>
              <Button label={t(language, "cloud.exportCloud")} variant="secondary" disabled={busy} loading={busy} onPress={() => run(async () => { await downloadText("StockLedger-cloud-export.json", await exportPersonalCloudData()); setMessage(t(language, "cloud.exported")); })} responsiveWidth="compact-full" />
              <Button label={t(language, "cloud.signOutLocal")} variant="ghost" disabled={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signOut({ scope: "local" }); if (error) throw error; setMessage(t(language, "cloud.signedOutLocal")); })} responsiveWidth="compact-full" />
              <Button label={t(language, "cloud.signOutGlobal")} variant="ghost" disabled={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signOut({ scope: "global" }); if (error) throw error; setMessage(t(language, "cloud.signedOutGlobal")); })} responsiveWidth="compact-full" />
            </View>
            <FormField label={t(language, "cloud.newPassword")} placeholder={t(language, "cloud.newPassword")} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" disabled={busy} />
            <FormField label={t(language, "cloud.confirmPassword")} placeholder={t(language, "cloud.confirmPassword")} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" disabled={busy} />
            <Button label={t(language, "cloud.updatePassword")} variant="secondary" disabled={busy || newPassword.length < 12 || newPassword !== confirmPassword} loading={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.updateUser({ password: newPassword }); if (error) throw error; setNewPassword(""); setConfirmPassword(""); setMessage(t(language, "cloud.passwordUpdated")); })} responsiveWidth="compact-full" />
            <Text variant="caption" tone="secondary">{t(language, "cloud.externalBackupLimit")}</Text>
            {!deletionStatus || deletionStatus.status === "failed" ? (
              <VStack gap="sm">
                <Text variant="h3">{t(language, "cloud.deleteTitle")}</Text>
                <Text tone="secondary">{t(language, "cloud.deleteBody")}</Text>
                <Button
                  label={deleteArmed ? t(language, "cloud.confirmDelete") : t(language, "cloud.requestDelete")}
                  variant="danger"
                  disabled={busy}
                  loading={busy}
                  onPress={() => {
                    if (!deleteArmed) { setDeleteArmed(true); return; }
                    void run(async () => { const status = await requestAccountDeletion(); setDeletionStatus(status); setDeleteArmed(false); setMessage(t(language, "cloud.deleteRequested")); });
                  }}
                  responsiveWidth="compact-full"
                />
              </VStack>
            ) : null}
          </VStack>
        ) : (
          <VStack gap="md">
            <Text tone="secondary">{t(language, "cloud.signInBody")}</Text>
            <FormField label={t(language, "cloud.emailPlaceholder")} placeholder={t(language, "cloud.emailPlaceholder")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" disabled={busy} />
            <FormField label={t(language, "cloud.passwordPlaceholder")} placeholder={t(language, "cloud.passwordPlaceholder")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" disabled={busy} />
            <Button label={t(language, "cloud.signIn")} disabled={busy || !email.trim() || !password} loading={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; setPassword(""); })} responsiveWidth="compact-full" />
            <Button label={t(language, "cloud.createAccount")} variant="secondary" disabled={busy || !email.trim() || password.length < 12} loading={busy} onPress={() => run(async () => { const { error } = await cloud!.auth.signUp({ email: email.trim(), password }); if (error) throw error; setPassword(""); setMessage(t(language, "cloud.accountSubmitted")); })} responsiveWidth="compact-full" />
            <Button label={t(language, "cloud.sendRecovery")} variant="ghost" disabled={busy || !email.trim()} onPress={() => run(async () => { const { error } = await cloud!.auth.resetPasswordForEmail(email.trim(), cloudRecoveryRedirect ? { redirectTo: cloudRecoveryRedirect } : undefined); if (error) throw error; setMessage(t(language, "cloud.recoverySent")); })} responsiveWidth="compact-full" />
            <Text variant="caption" tone="secondary">{t(language, "cloud.passwordRule")}</Text>
          </VStack>
        )}

        {errorMessage ? <AlertBanner tone="negative" title={errorMessage} /> : null}
        {message ? <AlertBanner tone="info" title={message} /> : null}
      </VStack>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  heading: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.md },
  copy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  actions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.sm },
  divider: { height: theme.strokeWidths.standard, backgroundColor: theme.colors.border.subtle, marginVertical: theme.spacing.sm },
}));

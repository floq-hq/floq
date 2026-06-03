/**
 * S7.0 — the accept side. A single "Have an invite code?" field that lands the
 * user paired, and renders every claim state (claimCopy) inline.
 *
 * Offline seam (S7.0): a network failure (not a typed AcceptError) maps to the
 * synthetic 'offline' outcome and PERSISTS the typed code (setPendingAcceptCode)
 * so the explicit Retry survives a reload. The field pre-fills from any such
 * persisted code on mount.
 *
 * On success it invalidates ['partner'] so the Partner tab flips to paired, and
 * calls onPaired (lets a host screen route / celebrate).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Text, TextField } from '../ui';
import { useTheme } from '../../theme';
import {
  AcceptError,
  INVITE_CODE_LENGTH,
  acceptInvite,
  useCurrentUser,
} from '../../services/firebase';
import {
  claimCopy,
  type AcceptOutcome,
} from '../../services/partner/claimCopy';
import { isOfflineError } from '../../services/partner/acceptError';
import {
  clearPendingAcceptCode,
  getPendingAcceptCode,
  setPendingAcceptCode,
} from '../../services/partner/localInvite';
import { partnerKeys } from '../../services/partner/usePartnerStatus';

export function InviteCodeField({
  onPaired,
  initialCode,
}: {
  onPaired?: () => void;
  /** Pre-fill (S7.0 F): a deep-link `floq://pair?code=` value, else any code
   *  persisted from an offline seam. */
  initialCode?: string;
}) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [code, setCode] = useState(() => initialCode ?? getPendingAcceptCode() ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<AcceptOutcome | null>(null);

  async function attempt(raw: string) {
    setSubmitting(true);
    try {
      const res = await acceptInvite(raw);
      clearPendingAcceptCode();
      setOutcome({ kind: 'paired', alreadyPaired: res.alreadyPaired });
      await qc.invalidateQueries({ queryKey: partnerKeys.status(user?.uid) });
      onPaired?.();
    } catch (e) {
      if (e instanceof AcceptError) {
        // A known, terminal-ish rejection — not an offline situation.
        if (e.reason !== 'bad-code') clearPendingAcceptCode();
        setOutcome({ kind: 'error', reason: e.reason });
      } else {
        // A non-AcceptError. Only a genuine connectivity drop is 'offline'; a
        // server rejection (e.g. permission-denied) is 'failed' — don't claim
        // the user is offline on a live connection. Keep the code for Retry either
        // way (a transient error may clear).
        setPendingAcceptCode(raw);
        setOutcome({ kind: 'error', reason: isOfflineError(e) ? 'offline' : 'failed' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const copy = outcome ? claimCopy(outcome) : null;
  const paired = outcome?.kind === 'paired';

  // Result view: claim-state copy + its single action.
  if (copy) {
    const toneColor =
      copy.tone === 'success' ? theme.success : copy.tone === 'danger' ? theme.danger : theme.text;
    const onAction = () => {
      if (copy.action === 'retry') void attempt(code);
      else setOutcome(null); // 'edit' / 'dismiss' → back to the field (or cleared)
    };
    return (
      <View style={styles.result}>
        <Text variant="bodyMedium" color={toneColor} style={styles.resultTitle}>
          {copy.title}
        </Text>
        <Text variant="caption" color={theme.textMuted} style={styles.resultBody}>
          {copy.body}
        </Text>
        {!paired && (
          <Button
            label={copy.actionLabel}
            variant="secondary"
            size="md"
            loading={submitting}
            onPress={onAction}
          />
        )}
      </View>
    );
  }

  const trimmed = code.trim();
  return (
    <View style={styles.root}>
      <TextField
        label="Have an invite code?"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH + 2} // tolerate a separator the normalizer strips
        placeholder="6-character code"
        returnKeyType="go"
        onSubmitEditing={() => trimmed && attempt(trimmed)}
        editable={!submitting}
      />
      <Button
        label="Pair"
        onPress={() => attempt(trimmed)}
        loading={submitting}
        disabled={trimmed.length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  result: { gap: 8, alignItems: 'flex-start' },
  resultTitle: {},
  resultBody: { marginBottom: 4 },
});

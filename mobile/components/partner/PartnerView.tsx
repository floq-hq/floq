/**
 * Partner view (S7.1) — the paired-state surface in the Partner tab.
 *
 * Renders the partner's live presence + their last completed session
 * (minutes / focus score / when / phase-at-end — NEVER task titles; the
 * social/summary projection omits them at source, L4) and a one-tap fire/clap
 * reaction anchored to that specific finished session (summary `ended_at`, so a
 * 🔥 names WHICH session it applauds — reactionUtils.isReactionCurrent).
 *
 * Split in two: `PartnerView` does the data binding (the M7.1/M7.2 read hooks +
 * the reaction writes — no Firestore beyond those), `PartnerViewContent` is the
 * pure presentation (props in, no I/O) so the layout can be previewed and reasoned
 * about without a live partnership. When the partner is dormant (no summary yet)
 * or hasn't granted consent (S7.2 wires the toggle; the rules deny summary/
 * presence reads until then), the hooks resolve to null and this degrades to a
 * calm "no sessions yet" state — never an error.
 *
 * The pairing-consent prompt and the beat-1 "start one too?" surface are S7.2;
 * the inbound finish card + mute/remove/block are S7.3.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Card, Pill, Text } from '../ui';
import { useTheme } from '../../theme';
import {
  usePartnerPresence,
  usePartnerProfile,
  usePartnerSummary,
  type PartnerSummary,
} from '../../services/social/partnerReads';
import type { DerivedPresence } from '../../services/presence/derivePresence';
import {
  removeReaction,
  sendReaction,
  type ReactionKind,
} from '../../services/social/reactions';
import {
  asPhase,
  canReact,
  formatWhen,
  presenceDisplay,
  shouldShowStartTogether,
} from '../../services/partner/partnerViewModel';
import { maybeRequestSocialNotifPermission } from '../../services/partner/notifSocialPrompt';
import { logEvent } from '../../services/analytics/logEvent';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';
import { StartTogetherPrompt } from './StartTogetherPrompt';
import { ShareConsentToggle } from './ShareConsentToggle';

const REACTIONS: { kind: ReactionKind; glyph: string; label: string }[] = [
  { kind: 'fire', glyph: '🔥', label: 'Send fire reaction' },
  { kind: 'clap', glyph: '👏', label: 'Send clap reaction' },
];

/** Data-binding wrapper: live presence + summary + name, the reaction writes,
 *  the beat-1 "start one too?" surface, and the one share-consent toggle (S7.2).
 *  Owns the SINGLE presence listener (Partner-tab-only per mobile/CLAUDE.md) and
 *  shares it across all three surfaces — no second subscription. */
export function PartnerView({
  partnerUid,
  pairId,
  fallbackName,
}: {
  partnerUid: string;
  pairId: string;
  /** Name from the status read; the live profile hook refines it once it resolves. */
  fallbackName?: string | null;
}) {
  const presence = usePartnerPresence(partnerUid);
  const { data: summary } = usePartnerSummary(partnerUid);
  const { data: profile } = usePartnerProfile(partnerUid);
  const hasActiveSession = useActiveSessionStore((s) => s.active != null);

  const name = profile?.displayName ?? fallbackName ?? 'Your partner';
  const endedAt = summary?.endedAt ?? null;

  // Optimistic, anchored to the session in view: a new finished session (new
  // ended_at) clears any prior selection so the reaction always names the
  // session currently on screen.
  const [reacted, setReacted] = useState<ReactionKind | null>(null);
  useEffect(() => {
    setReacted(null);
  }, [endedAt]);

  function onReact(kind: ReactionKind) {
    if (!canReact(endedAt)) return;
    if (reacted === kind) {
      setReacted(null);
      void removeReaction(partnerUid).catch(() => {});
      return;
    }
    setReacted(kind);
    void sendReaction(partnerUid, kind, endedAt as number).catch(() => {});
    // S7.2: a reaction is real social intent — the moment to ask for the OS
    // notification permission (decoupled from the consent toggle; once).
    void maybeRequestSocialNotifPermission('reaction');
  }

  function onStartTogether() {
    logEvent('start_together');
    router.navigate('/session'); // the launchpad; the start flow lives there
  }

  return (
    <View style={styles.stack}>
      {shouldShowStartTogether(presence, hasActiveSession) && (
        <StartTogetherPrompt partnerName={name} onStart={onStartTogether} />
      )}
      <PartnerViewContent
        name={name}
        presence={presence}
        summary={summary ?? null}
        reacted={reacted}
        onReact={onReact}
      />
      <ShareConsentToggle pairId={pairId} partnerName={name} />
    </View>
  );
}

/** Pure presentation — props in, no I/O. The single source of the partner-view layout. */
export function PartnerViewContent({
  name,
  presence,
  summary,
  reacted,
  onReact,
}: {
  name: string;
  presence: DerivedPresence;
  summary: PartnerSummary | null;
  reacted: ReactionKind | null;
  onReact: (kind: ReactionKind) => void;
}) {
  const theme = useTheme();
  const chip = presenceDisplay(presence);
  const chipColor = chip.phase ? theme.phase[chip.phase] : theme.success;

  return (
    <Card>
      <View style={styles.header}>
        {/* social/profile projects only display_name — no photo URL crosses the
            partner boundary, so the partner avatar is always the initials monogram. */}
        <Avatar name={name} photoURL={null} size={48} />
        <View style={styles.headerText}>
          <Text variant="caption" color={theme.textMuted}>
            YOUR PARTNER
          </Text>
          <Text variant="title" style={styles.name} numberOfLines={1}>
            {name}
          </Text>
        </View>
      </View>

      {chip.visible && (
        <Pill label={chip.label} color={chipColor} variant="subtle" dot style={styles.chip} />
      )}

      {summary ? (
        <View style={styles.summary}>
          <View style={styles.metrics}>
            <Metric value={`${summary.minutes}`} unit="min" />
            <Metric value={`${Math.round(summary.focusScore)}`} unit="focus" />
          </View>
          <View style={styles.whenRow}>
            <Pill
              label={asPhase(summary.phaseAtEnd)}
              color={theme.phase[asPhase(summary.phaseAtEnd)]}
              variant="subtle"
              uppercase
              size="tiny"
            />
            <Text variant="caption" color={theme.textMuted}>
              {formatWhen(summary.endedAt, Date.now())}
            </Text>
          </View>

          <View style={styles.reactions} accessibilityRole="radiogroup">
            {REACTIONS.map(({ kind, glyph, label }) => {
              const selected = reacted === kind;
              return (
                <Pressable
                  key={kind}
                  onPress={() => onReact(kind)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  style={({ pressed }) => [
                    styles.reaction,
                    {
                      borderColor: selected ? theme.accent : theme.border,
                      backgroundColor: selected ? theme.accentMuted : 'transparent',
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text variant="body" maxFontSizeMultiplier={1.2}>
                    {glyph}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <Text variant="body" color={theme.textMuted} style={styles.dormant}>
          {chip.visible
            ? `${name} is focusing right now — their session will show up here once they finish.`
            : `${name} hasn’t focused yet. Their sessions will appear here once they do.`}
        </Text>
      )}
    </Card>
  );
}

/** A single big-number / unit metric in the summary row. */
function Metric({ value, unit }: { value: string; unit: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metric}>
      <Text variant="title" maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
      <Text variant="caption" color={theme.textMuted}>
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  name: {},
  chip: { alignSelf: 'flex-start', marginTop: 12 },
  summary: { marginTop: 16, gap: 12 },
  metrics: { flexDirection: 'row', gap: 32 },
  metric: { alignItems: 'flex-start', gap: 2 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reactions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  reaction: {
    width: 52,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dormant: { marginTop: 16 },
});

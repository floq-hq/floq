/**
 * Session card share modal (S6.0). Presents a completed session as a shareable
 * card with a Curve ⇄ Minimal chooser, plus Share + Close. The "anytime" surface:
 * opened from the Stats Recent list (any past session) and from the session-end
 * summary. Sharing captures whichever card is showing to a PNG and opens the OS
 * share sheet (services/share/shareSessionCard).
 *
 * Two card variants (SessionCardCurve / SessionCardMinimal) render into the SAME
 * captured View, so the toggle needs no change to the capture/share path. The
 * share result is surfaced (audit #5: a 'failed' capture used to fail silently).
 *
 * Controlled: render with `data` non-null to show it; `onClose` dismisses. The
 * all-time average (for the "above your average" insight) is read here via a
 * TanStack query over the focus-score series — not on the screen's render path.
 */
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import type { View as RNView } from 'react-native';
import { Button, SegmentedControl, Text } from '../ui';
import { useTheme } from '../../theme';
import { getFocusScoreSeries } from '../../services/storage/sessions';
import {
  meanScore,
  sessionInsight,
  type SessionCardData,
} from '../../services/share/sessionInsight';
import { shareSessionCard } from '../../services/share/shareSessionCard';
import { SessionCardCurve } from './SessionCardCurve';
import { SessionCardMinimal } from './SessionCardMinimal';

type CardVariant = 'curve' | 'minimal';

const VARIANTS: { label: string; value: CardVariant }[] = [
  { label: 'Curve', value: 'curve' },
  { label: 'Minimal', value: 'minimal' },
];

export function SessionCardModal({
  data,
  onClose,
}: {
  data: SessionCardData | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<RNView>(null);
  const [sharing, setSharing] = useState(false);
  const [which, setWhich] = useState<CardVariant>('curve');
  const [error, setError] = useState(false);

  const { data: avg = null } = useQuery({
    queryKey: ['stats', 'avgScore'],
    queryFn: () => meanScore(getFocusScoreSeries()),
    enabled: data != null,
  });

  const onShare = async () => {
    setError(false);
    setSharing(true);
    const result = await shareSessionCard(cardRef);
    setSharing(false);
    if (result === 'failed') setError(true);
  };

  const insight = data ? sessionInsight(data, avg) : '';

  return (
    <Modal visible={data != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onClose}>
        {/* One cohesive column, all children the card's width — Stop taps on the
            content from closing the sheet. */}
        <Pressable style={styles.content} onPress={() => {}}>
          <SegmentedControl options={VARIANTS} value={which} onChange={setWhich} />

          {data && (
            <View ref={cardRef} collapsable={false}>
              {which === 'curve' ? (
                <SessionCardCurve data={data} insight={insight} />
              ) : (
                <SessionCardMinimal data={data} insight={insight} />
              )}
            </View>
          )}

          {error ? (
            <Text variant="caption" color={theme.danger} style={styles.error}>
              Couldn’t create the image — try again.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button label="Share" onPress={onShare} loading={sharing} style={styles.action} />
            <Button label="Close" variant="secondary" onPress={onClose} style={styles.action} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // Fixed to the card's width so the toggle, card, and buttons line up as one
  // unit (and the buttons can't stretch off-screen). Default align is 'stretch',
  // so the toggle + actions fill this width; the 320-wide card fits exactly.
  content: { width: 320, gap: 16 },
  error: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});

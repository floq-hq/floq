/**
 * Session card share modal (S6.0). Presents the SessionCard for one session
 * with Share + Close. The "anytime" surface: opened from the Stats Recent list
 * (any past session) and from the session-end summary. Sharing captures the
 * card to a PNG and opens the OS share sheet (services/share/shareSessionCard).
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
import { Button, Text } from '../ui';
import { useTheme } from '../../theme';
import { getFocusScoreSeries } from '../../services/storage/sessions';
import {
  meanScore,
  sessionInsight,
  type SessionCardData,
} from '../../services/share/sessionInsight';
import { shareSessionCard } from '../../services/share/shareSessionCard';
import { SessionCard } from './SessionCard';

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

  const { data: avg = null } = useQuery({
    queryKey: ['stats', 'avgScore'],
    queryFn: () => meanScore(getFocusScoreSeries()),
    enabled: data != null,
  });

  const onShare = async () => {
    setSharing(true);
    await shareSessionCard(cardRef);
    setSharing(false);
  };

  const insight = data ? sessionInsight(data, avg) : '';

  return (
    <Modal visible={data != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { paddingBottom: insets.bottom + 16 }]} onPress={onClose}>
        {/* Stop taps on the content from closing the sheet. */}
        <Pressable style={styles.content} onPress={() => {}}>
          {data && (
            <View ref={cardRef} collapsable={false}>
              <SessionCard data={data} insight={insight} />
            </View>
          )}

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
  content: { alignItems: 'center', gap: 20 },
  actions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', paddingHorizontal: 4 },
  action: { flex: 1 },
});

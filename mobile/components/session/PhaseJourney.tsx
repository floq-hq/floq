/**
 * Phase Journey (Session launchpad) — the focal point that REPLACES the
 * recommendation ring here (the ring is Home's; showing it twice wasted the
 * launchpad's identity — see decisions.md L25 hub-vs-launchpad).
 *
 * It previews the *shape* of the upcoming session: a flat segmented bar of the
 * flow phases this plan will move through (Struggle → Release → Flow), each
 * segment's width proportional to its minutes, in the phase color tokens — the
 * same colors the user will meet mid-session. A trailing faint segment previews
 * the recovery break. This reinforces Floq's central anti-Pomodoro claim at the
 * moment of commitment, and is honest about short plans (a low-clamped 16-min
 * recommendation is all Struggle — the bar shows exactly that).
 *
 * design-system.md: flat, single subtle surface, no gradient/shadow; phase
 * colors are sanctioned functional colors. Tokens only, never raw hex.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../ui';
import { previewPhases } from '../../services/session/phasePreview';
import type { Phase, SessionPlan } from '../../services/timer';
import { useTheme } from '../../theme';

type Props = Pick<SessionPlan, 'focusMinutes' | 'breakMinutes' | 'regime'>;

const PHASE_LABEL: Record<Phase, string> = {
  struggle: 'Struggle',
  release: 'Release',
  flow: 'Flow',
  recovery: 'Recovery',
};

// Minimum flex so a 1-min Release segment stays visible in the bar instead of
// collapsing to a hairline (honest proportions, but never invisible).
const MIN_WEIGHT = 0.06;

function PhaseJourneyBase({ focusMinutes, breakMinutes, regime }: Props) {
  const theme = useTheme();
  const segments = previewPhases({ focusMinutes, breakMinutes, regime });

  const phaseColor = (p: Phase) => theme.phase[p];

  return (
    <View style={styles.root}>
      {/* The segmented bar: focus phases at full color + a faint trailing break. */}
      <View style={styles.bar}>
        {segments.map((seg, i) => (
          <View
            key={`${seg.phase}-${i}`}
            style={[
              styles.seg,
              {
                flexGrow: Math.max(seg.minutes / focusMinutes, MIN_WEIGHT),
                backgroundColor: phaseColor(seg.phase),
              },
            ]}
          />
        ))}
        {breakMinutes > 0 ? (
          <View
            style={[
              styles.seg,
              styles.breakSeg,
              { flexGrow: MIN_WEIGHT, backgroundColor: theme.phase.recovery },
            ]}
          />
        ) : null}
      </View>

      {/* Phase legend — names + minute spans, derived from the same segments. */}
      <View style={styles.legend}>
        {segments.map((seg, i) => {
          const start = segments.slice(0, i).reduce((n, s) => n + s.minutes, 0);
          return (
            <View key={`lg-${seg.phase}-${i}`} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: phaseColor(seg.phase) }]} />
              <Text variant="tiny" color={theme.textMuted}>
                {PHASE_LABEL[seg.phase]} {start}–{start + seg.minutes}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The recommendation, kept but de-emphasized (Home's ring owns the big
          number). One quiet line so no info is lost. */}
      <Text variant="caption" color={theme.textMuted} style={styles.center}>
        ~{focusMinutes} min focus · {breakMinutes} min break
      </Text>
    </View>
  );
}

export const PhaseJourney = memo(PhaseJourneyBase);

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', alignItems: 'center', gap: 12 },
  bar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: 10,
    borderRadius: 9999,
    overflow: 'hidden',
    gap: 2,
  },
  seg: { height: 10, borderRadius: 9999 },
  breakSeg: { opacity: 0.5 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  center: { textAlign: 'center' },
});

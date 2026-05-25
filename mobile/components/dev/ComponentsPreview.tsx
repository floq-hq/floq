/**
 * Kitchen-sink preview for the UI primitives (S1.3). Dev-only — rendered from
 * the `app/dev.tsx` route (reachable at /dev in a dev build), not linked from
 * the app UI.
 *
 * The theme toggle at the top is the real `SegmentedControl` primitive, so this
 * screen also serves as the "renders correctly in both themes" check: flip it
 * and every section below repaints.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Button,
  Card,
  Pill,
  SegmentedControl,
  Slider,
  Text,
  type SegmentedControlOption,
} from '../ui';
import { useTheme } from '../../theme';
import { useThemeSettings, type ThemeOverride } from '../../theme/ThemeContext';
import { typographyScale, type TypographyToken } from '../../theme/typography';

const THEME_OPTIONS: SegmentedControlOption<ThemeOverride>[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

const DIFFICULTY_OPTIONS: SegmentedControlOption<string>[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
];

const TYPE_TOKENS: TypographyToken[] = [
  'display',
  'title',
  'heading',
  'body',
  'bodyMedium',
  'label',
  'caption',
  'tiny',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="heading" color={theme.textMuted}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function ComponentsPreview() {
  const theme = useTheme();
  const { scheme, override, setOverride } = useThemeSettings();
  const [difficulty, setDifficulty] = useState('medium');
  const [fatigue, setFatigue] = useState(0.4);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">UI primitives</Text>
        <Text variant="caption" color={theme.textMuted}>
          resolved: {scheme} · override: {override}
        </Text>

        <Section title="Theme">
          <SegmentedControl options={THEME_OPTIONS} value={override} onChange={setOverride} />
        </Section>

        <Section title="Typography">
          {TYPE_TOKENS.map((token) => (
            <Text key={token} variant={token}>
              {token} · {typographyScale[token].fontSize}/{typographyScale[token].fontWeight}
            </Text>
          ))}
        </Section>

        <Section title="Buttons · primary / secondary / ghost">
          <Button label="Primary lg" onPress={() => {}} variant="primary" size="lg" />
          <Button label="Secondary lg" onPress={() => {}} variant="secondary" size="lg" />
          <Button label="Ghost lg" onPress={() => {}} variant="ghost" size="lg" />
          <View style={styles.row}>
            <Button label="Primary md" onPress={() => {}} variant="primary" size="md" />
            <Button label="Secondary md" onPress={() => {}} variant="secondary" size="md" />
          </View>
          <View style={styles.row}>
            <Button label="Disabled" onPress={() => {}} disabled />
            <Button label="Loading" onPress={() => {}} loading />
          </View>
        </Section>

        <Section title="Card">
          <Card>
            <Text variant="heading">Flat card</Text>
            <Text variant="body" color={theme.textMuted}>
              bgElevated · 1px border · no shadow
            </Text>
          </Card>
          <Card elevated>
            <Text variant="heading">Elevated card</Text>
            <Text variant="body" color={theme.textMuted}>
              the single allowed elevation shadow
            </Text>
          </Card>
        </Section>

        <Section title="Pills · phase indicators (subtle + dot + uppercase)">
          <View style={styles.row}>
            <Pill label="Struggle" color={theme.phase.struggle} dot uppercase size="tiny" />
            <Pill label="Release" color={theme.phase.release} dot uppercase size="tiny" />
            <Pill label="Flow" color={theme.phase.flow} dot uppercase size="tiny" />
            <Pill label="Recovery" color={theme.phase.recovery} dot uppercase size="tiny" />
          </View>
        </Section>

        <Section title="Pills · tags (subtle vs solid)">
          <View style={styles.row}>
            <Pill label="Easy" color={theme.success} variant="subtle" />
            <Pill label="Medium" color={theme.accent} variant="subtle" />
            <Pill label="Hard" color={theme.danger} variant="subtle" />
          </View>
          <View style={styles.row}>
            <Pill label="Easy" color={theme.success} variant="solid" />
            <Pill label="Medium" color={theme.accent} variant="solid" />
            <Pill label="Hard" color={theme.danger} variant="solid" />
          </View>
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={setDifficulty}
          />
          <Text variant="caption" color={theme.textMuted}>
            selected: {difficulty}
          </Text>
        </Section>

        <Section title="Slider (native — dev build only)">
          <Slider value={fatigue} onValueChange={setFatigue} minimumValue={0} maximumValue={1} />
          <Text variant="caption" color={theme.textMuted}>
            value: {fatigue.toFixed(2)}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 8 },
  section: { marginTop: 24, gap: 12 },
  sectionBody: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
});

/**
 * Reusable drag-to-reorder task list (S2.6). One component for every place we
 * show an editable task list — the brain-dump review (S2.4) and the queue
 * management sheet (S2.6) — so reorder/delete behave identically.
 *
 * Per row: ≡ handle to drag-reorder (grab-and-drag via onPressIn, which hands
 * the touch straight to draggable-flatlist's pan), swipe-left to delete, and an
 * optional tap-to-edit. Controlled — the parent owns the array and the actions.
 *
 * Items only need an `id` (stable key for the draggable list) + the display
 * fields; callers pass Task (queue) or id-augmented ParsedTask (review).
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pill, Text } from './ui';
import { useTheme } from '../theme';
import type { Difficulty } from '../services/tasks';

export type DraggableTaskRow = {
  id: string;
  title: string;
  estMinutes: number;
  difficulty: Difficulty;
};

export function DraggableTaskList<T extends DraggableTaskRow>({
  items,
  onReorder,
  onRemove,
  onEdit,
  contentContainerStyle,
}: {
  items: T[];
  onReorder: (from: number, to: number) => void;
  onRemove: (item: T) => void;
  /** Omit to make rows non-editable (e.g. the pre-save brain-dump review). */
  onEdit?: (item: T) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<T>) => (
      // No ScaleDecorator: scaling the active row up clipped its sides while
      // dragging. The isActive opacity below is the drag feedback instead.
      <ReanimatedSwipeable
          renderRightActions={() => (
            <Pressable
              onPress={() => onRemove(item)}
              style={[styles.delete, { backgroundColor: theme.danger }]}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.title}`}
            >
              <Text variant="label" color={theme.textInverse}>
                Delete
              </Text>
            </Pressable>
          )}
        >
          <View
            style={[
              styles.row,
              { backgroundColor: theme.bgElevated, borderColor: theme.border, opacity: isActive ? 0.9 : 1 },
            ]}
          >
            <Pressable
              onPress={onEdit ? () => onEdit(item) : undefined}
              style={styles.info}
              accessibilityRole={onEdit ? 'button' : undefined}
              accessibilityLabel={onEdit ? `Edit ${item.title}` : item.title}
            >
              <Text variant="bodyMedium" numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.pills}>
                <Pill label={`${item.estMinutes} min`} color={theme.textMuted} />
                <Pill label={`Difficulty ${item.difficulty}/5`} color={theme.accent} />
              </View>
            </Pressable>
            {/* Grab-and-drag handle (onPressIn → draggable-flatlist's pan). */}
            <Pressable
              onPressIn={drag}
              disabled={isActive}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Reorder ${item.title}`}
              style={styles.handle}
            >
              <Text variant="title" color={theme.textMuted}>
                ≡
              </Text>
            </Pressable>
          </View>
        </ReanimatedSwipeable>
    ),
    [onEdit, onRemove, theme],
  );

  return (
    <DraggableFlatList
      data={items}
      keyExtractor={(it) => it.id}
      onDragEnd={({ from, to }) => {
        if (from !== to) onReorder(from, to);
      }}
      renderItem={renderItem}
      contentContainerStyle={contentContainerStyle ?? styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { gap: 12, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  info: { flex: 1, gap: 8 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  handle: { paddingLeft: 12, paddingVertical: 8, justifyContent: 'center' },
  delete: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
  },
});

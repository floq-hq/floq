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
import { Text } from './ui';
import { TaskSummary } from './TaskSummary';
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
  style,
}: {
  items: T[];
  onReorder: (from: number, to: number) => void;
  onRemove: (item: T) => void;
  /** Omit to make rows non-editable (e.g. the pre-save brain-dump review). */
  onEdit?: (item: T) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Outer CONTAINER style. Pass `{ flex: 1 }` when the list shares a column
   *  with a pinned footer so it scrolls internally instead of pushing the footer
   *  off (TaskQueueSheet). Goes to draggable-flatlist's `containerStyle` (the
   *  flex must live on the wrapper, NOT the inner list, or it collapses to 0).
   *  Omitted, the list sizes to content (brain-dump review). */
  style?: StyleProp<ViewStyle>;
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
              {
                // Opaque so the swipe-to-delete stays hidden until swiped. Flat
                // on the screen bg (no per-row card); a hairline divider sets
                // rows apart. Lifts to the elevated surface while dragging.
                backgroundColor: isActive ? theme.bgElevated : theme.bg,
                borderBottomColor: theme.border,
                opacity: isActive ? 0.97 : 1,
              },
            ]}
          >
            <Pressable
              onPress={onEdit ? () => onEdit(item) : undefined}
              style={styles.info}
              accessibilityRole={onEdit ? 'button' : undefined}
              accessibilityLabel={onEdit ? `Edit ${item.title}` : item.title}
            >
              <TaskSummary
                title={item.title}
                difficulty={item.difficulty}
                estMinutes={item.estMinutes}
                titleVariant="bodyMedium"
                titleLines={2}
              />
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
      containerStyle={style}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle ?? styles.listContent}
    />
  );
}

// Horizontal inset lives INSIDE the row (not on the list container) so each row
// — including the one lifted while dragging — spans the full screen width edge-
// to-edge, instead of a floating, inset card that looks "cut". Callers keep the
// list full-bleed and pad their own header/footer.
const ROW_PAD = 24;

const styles = StyleSheet.create({
  listContent: { paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: ROW_PAD,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1 },
  handle: { paddingLeft: 12, paddingVertical: 8, justifyContent: 'center' },
  delete: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});

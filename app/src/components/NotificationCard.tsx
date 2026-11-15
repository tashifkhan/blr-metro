import { useHaptics } from '../hooks/useHaptics';
import { memo, useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Touchable } from './Touchable';
import { useAppTheme } from '../theme/ThemeContext';
import type { PassengerNotification } from '../types';
import { spacing, shape, emphasis } from '../theme';
import { duration } from '../theme/motion';

/** Where the card sits in a segmented list; decides which corners are round. */
export type NoticePosition = 'single' | 'first' | 'middle' | 'last';

interface Props {
  notification: PassengerNotification;
  position?: NoticePosition;
}

/** "2026-04-13T11:21:49.000Z" to "13 Apr 2026". Unknown formats pass through. */
export function formatNoticeDate(value: string): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = value.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One BMRCL notice. The corporation publishes these as PDFs, so the card
 * opens the document in the browser instead of expanding in place.
 */
export const NotificationCard = memo(function NotificationCard({
  notification,
  position = 'single',
}: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const haptics = useHaptics();

  const title = notification.title.trim();
  const kannada = notification.title_kn?.trim();
  const pdfUrl = notification.link_to_file?.trim() || null;

  const handleOpen = useCallback(() => {
    if (!pdfUrl) return;
    void Linking.openURL(pdfUrl).catch(() => haptics.error());
  }, [pdfUrl, haptics]);

  const outer = shape.xl;
  const inner = shape.sm;
  const top = position === 'single' || position === 'first' ? outer : inner;
  const bottom = position === 'single' || position === 'last' ? outer : inner;
  const corners = {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };

  const showKannada = Boolean(kannada) && kannada !== title;

  return (
    <Animated.View
      layout={LinearTransition.duration(duration.medium2)}
      style={[styles.container, corners, { backgroundColor: fills.containerLow }]}
    >
      <Touchable
        onPress={pdfUrl ? handleOpen : undefined}
        radius={0}
        haptic="select"
        accessibilityRole={pdfUrl ? 'button' : undefined}
        accessibilityLabel={title}
        accessibilityHint={pdfUrl ? 'Opens the notice as a PDF' : 'No document attached'}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Ionicons
              name="megaphone-outline"
              size={20}
              color={theme.colors.onSecondaryContainer}
            />
          </View>
          <View style={styles.summary}>
            <Text
              variant="titleSmall"
              numberOfLines={3}
              selectable
              style={[emphasis.strong, styles.title, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            {showKannada ? (
              <Text
                variant="bodySmall"
                numberOfLines={2}
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {kannada}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={[styles.dateChip, { backgroundColor: fills.containerHigh }]}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={13}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatNoticeDate(notification.date)}
                </Text>
              </View>
              {pdfUrl ? (
                <View style={[styles.dateChip, { backgroundColor: fills.containerHigh }]}>
                  <Ionicons
                    name="document-text-outline"
                    size={13}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    PDF
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {pdfUrl ? (
            <View style={styles.trailing}>
              <Ionicons name="open-outline" size={20} color={theme.colors.onSurfaceVariant} />
            </View>
          ) : null}
        </View>
      </Touchable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  trailing: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

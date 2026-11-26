import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { Touchable } from './Touchable';
import { emphasis, spacing } from '../theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}

export function SettingRow({ icon, title, detail, onPress }: Props) {
  const theme = useTheme();

  return (
    <Touchable
      radius={0}
      haptic="navigate"
      onPress={onPress}
      accessibilityLabel={`${title}. ${detail}`}
    >
      <View style={styles.row}>
        <Ionicons name={icon} size={22} color={theme.colors.onSurfaceVariant} />
        <View style={styles.text}>
          <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {detail}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
      </View>
    </Touchable>
  );
}

export function SettingDivider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 64,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.base,
  },
});

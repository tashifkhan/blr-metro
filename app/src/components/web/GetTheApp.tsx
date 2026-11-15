import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';

import { Card } from '../Card';
import { SectionHeader } from '../SectionHeader';
import { Touchable } from '../Touchable';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { useAppTheme } from '../../theme/ThemeContext';
import { emphasis, overline, radius, spacing } from '../../theme';

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  /** Tinted leading tile, for the row to reach for first. */
  accent?: boolean;
  trailing?: 'download' | 'install' | 'soon';
  onPress?: () => void;
  accessibilityRole?: 'button' | 'link';
  accessibilityHint?: string;
}

function Row({
  icon,
  title,
  subtitle,
  accent = false,
  trailing,
  onPress,
  accessibilityRole = 'button',
  accessibilityHint,
}: RowProps) {
  const theme = useTheme();
  const { fills } = useAppTheme();

  const body = (
    <View style={styles.row}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: accent ? fills.accentSubtle : fills.subtle },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={accent ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
      </View>
      <View style={styles.rowText}>
        <Text
          variant="titleSmall"
          style={[
            emphasis.strong,
            { color: onPress ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
          ]}
        >
          {title}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {subtitle}
        </Text>
      </View>
      {trailing === 'soon' ? (
        <View style={[styles.badge, { backgroundColor: fills.inset }]}>
          <Text variant="labelSmall" style={[overline, { color: theme.colors.onSurfaceVariant }]}>
            Soon
          </Text>
        </View>
      ) : trailing ? (
        <Ionicons
          name={trailing === 'install' ? 'add-circle-outline' : 'download-outline'}
          size={18}
          color={accent ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
      ) : null}
    </View>
  );

  // A row with nothing to open stays flat. One that ripples and then does
  // nothing reads as a broken link rather than as a note.
  if (!onPress) {
    return (
      <View accessibilityLabel={`${title}, ${subtitle}`}>{body}</View>
    );
  }

  return (
    <Touchable
      radius={radius.hero}
      haptic="press"
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
    >
      {body}
    </Touchable>
  );
}

/**
 * Install and download links, web only.
 *
 * In a browser this page is all there is, and nothing on it says the app can
 * be installed or that a native build exists. Native already is the app, so it
 * renders nothing here.
 */
export function GetTheApp() {
  const { fills } = useAppTheme();
  const install = usePwaInstall();

  if (Platform.OS !== 'web') return null;

  const divider = <View style={[styles.divider, { backgroundColor: fills.hairline }]} />;

  return (
    <View style={styles.section}>
      <SectionHeader title="Get the app" icon="phone-portrait-outline" />
      <Card radius={radius.hero} style={styles.card}>
        {install.canInstall ? (
          <>
            <Row
              icon="add-circle-outline"
              title="Install this app"
              subtitle="Runs from your home screen, in its own window"
              accent
              trailing="install"
              onPress={install.install}
              accessibilityHint="Opens the browser's install dialog"
            />
            {divider}
          </>
        ) : null}

        <Row
          icon="phone-portrait-outline"
          title="Android"
          subtitle="No build yet. This site works in Chrome in the meantime"
          accent={!install.canInstall}
          trailing="soon"
        />
        {divider}

        <Row
          icon="logo-apple"
          title="iOS"
          subtitle={
            install.needsManualInstall
              ? 'No build yet. Tap Share, then Add to Home Screen'
              : 'No build yet. This site works in Safari in the meantime'
          }
          trailing="soon"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  card: {
    borderRadius: radius.hero,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  badge: {
    borderRadius: radius.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  divider: {
    height: 1,
  },
});

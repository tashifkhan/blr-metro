import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { Card } from '../components/Card';
import { SettingDivider, SettingRow } from '../components/SettingRow';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList } from '../navigation/types';
import { spacing } from '../theme';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Settings'>;

const STYLE_NAMES = { studio: 'Studio', material: 'Material', plain: 'Plain' } as const;
const MODE_NAMES = { system: 'follows the system', light: 'light', dark: 'dark' } as const;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { settings } = useAppTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Card>
        <SettingRow
          icon="color-palette-outline"
          title="Appearance"
          detail={`${STYLE_NAMES[settings.uiStyle]}, ${MODE_NAMES[settings.themeMode]}`}
          onPress={() => navigation.navigate('Appearance')}
        />
        <SettingDivider color={theme.colors.outlineVariant} />
        <SettingRow
          icon="information-circle-outline"
          title="About"
          detail="Version, data sources and credits"
          onPress={() => navigation.navigate('About')}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.sm,
    paddingBottom: spacing['4xl'],
  },
});

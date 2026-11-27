import { useHaptics } from '../../hooks/useHaptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, FAB, Surface, Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMapFamilyPrimaryQuery } from '../../hooks';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import { OfflineNote } from '../../components/OfflineNote';
import { Touchable } from '../../components/Touchable';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing, radius, emphasis } from '../../theme';
import { useMetroNetwork } from '../../network';
import { mapService } from '../../services/mapService';
import type { MapFamily } from '../../types';
import {
  notifyMapSaveFailed,
  notifyMapUnavailable,
  saveNetworkMap,
} from '../../services/mapDownload';
import { clamp, imageTransform, type ImageTransform, type MapMotion, type MapSize } from './mapViewport';
import { OfficialMapRaster } from './OfficialMapRaster';
import { useAdaptedStyles } from '../../theme/useAdaptedStyles';
import { useMapGestures, useWebMapZoom } from './useMapGestures';

const ZOOM_STEP = 0.5;

const FAMILIES: { key: MapFamily; label: string }[] = [
  { key: 'schematic', label: 'Schematic' },
  { key: 'phase', label: 'Phase map' },
];

type HighResolutionMapImageProps = {
  uri: string;
  imageStyle: ReturnType<typeof useAnimatedStyle>;
  onSize: (size: MapSize) => void;
};

function HighResolutionMapImage({ uri, imageStyle, onSize }: HighResolutionMapImageProps) {
  const styles = useAdaptedStyles(baseStyles);
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const handleReady = useCallback((size: MapSize) => {
    onSize(size);
    setLoading(false);
  }, [onSize]);
  const handleError = useCallback(() => setFailed(true), []);

  if (failed) {
    return (
      <ErrorState
        message="The complete network map could not be loaded"
        onRetry={() => {
          setFailed(false);
          setLoading(true);
          setRetryKey((value) => value + 1);
        }}
      />
    );
  }

  return (
    <>
      {loading && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.loader,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Loading high-resolution map...
          </Text>
        </View>
      )}
      <Animated.View style={[styles.image, imageStyle]} pointerEvents="none">
        <OfficialMapRaster key={retryKey} uri={uri} onReady={handleReady} onError={handleError} />
      </Animated.View>
    </>
  );
}

/**
 * The operator's own published network map: zoomable, with save to device.
 * The schematic map screen switches to this from its layers button.
 */
export function OfficialMapView() {
  const styles = useAdaptedStyles(baseStyles);
  const isFocused = useIsFocused();
  const feedbackAllowed = useRef(isFocused);
  feedbackAllowed.current = isFocused;
  useEffect(() => () => { feedbackAllowed.current = false; }, []);
  const haptics = useHaptics();
  const theme = useTheme();
  const { fills } = useAppTheme();
  const { network, networkName } = useMetroNetwork();
  const insets = useSafeAreaInsets();
  const [family, setFamily] = useState<MapFamily>('schematic');
  const { data, isLoading, isError, isOfflineCopy, refetch } =
    useMapFamilyPrimaryQuery(family);
  const [downloading, setDownloading] = useState(false);
  const downloadInFlight = useRef(false);
  const canvasRef = useRef<View>(null);
  const canvas = useSharedValue<MapSize>({ width: 0, height: 0 });
  const image = useSharedValue<MapSize>({ width: 0, height: 0 });
  const transform = useSharedValue<ImageTransform>([0, 0, 1]);
  const zoomTarget = useSharedValue<number | null>(null);
  const hapticSelect = haptics.select;
  const imageStyle = useAnimatedStyle(() => {
    const [x, y, scale] = transform.value;
    return { transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });

  const reframe = useCallback((size: MapSize, isImage: boolean) => {
    'worklet';
    if (size.width <= 0 || size.height <= 0) return;
    if (isImage) image.value = size;
    else canvas.value = size;
    zoomTarget.value = null;
    transform.value = imageTransform(transform.value, canvas.value, image.value, {
      x: 0, y: 0, dx: 0, dy: 0, scale: 1,
    });
  }, [canvas, image, transform, zoomTarget]);

  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    scheduleOnUI(reframe, { width, height }, false);
  }, [reframe]);

  const handleImageSize = useCallback((size: MapSize) => scheduleOnUI(reframe, size, true), [reframe]);

  const start = useCallback(() => {
    'worklet';
    cancelAnimation(transform);
    zoomTarget.value = null;
  }, [transform, zoomTarget]);

  const move = useCallback((motion: MapMotion) => {
    'worklet';
    transform.value = imageTransform(transform.value, canvas.value, image.value, motion);
  }, [canvas, image, transform]);

  const animateZoom = useCallback((next: ImageTransform) => {
    'worklet';
    scheduleOnRN(hapticSelect);
    zoomTarget.value = next[2];
    transform.value = withTiming(next, { duration: 180 }, (finished) => {
      if (finished) zoomTarget.value = null;
    });
  }, [hapticSelect, transform, zoomTarget]);

  const doubleTap = useCallback((x: number, y: number) => {
    'worklet';
    const current = transform.value;
    const next = current[2] > 1.2
      ? ([0, 0, 1] satisfies ImageTransform)
      : imageTransform(current, canvas.value, image.value, { x, y, dx: 0, dy: 0, scale: 2.5 / current[2] });
    animateZoom(next);
  }, [animateZoom, canvas, image, transform]);

  const gestures = useMapGestures({ start, move, doubleTap });
  const loading = isLoading && !data;
  const failed = isError && !data;
  useWebMapZoom(canvasRef, 'always', { start, move }, !loading && !failed);

  const zoomBy = (step: number) => {
    scheduleOnUI(() => {
      'worklet';
      const current = transform.value;
      const target = zoomTarget.value ?? current[2];
      const scale = clamp(target + step, 1, 5);
      if (scale === target) return;
      const size = canvas.value;
      animateZoom(imageTransform(current, size, image.value, {
        x: size.width / 2, y: size.height / 2, dx: 0, dy: 0, scale: scale / current[2],
      }));
    });
  };

  const handleDownloadMap = async () => {
    if (downloadInFlight.current) return;
    const asset = data?.image;
    if (!asset?.url) {
      haptics.warning();
      notifyMapUnavailable();
      return;
    }
    try {
      downloadInFlight.current = true;
      setDownloading(true);
      haptics.press();

      const extension =
        asset.content_type?.toLowerCase().includes('png') ||
        asset.source_url.toLowerCase().endsWith('.png')
          ? 'png'
          : 'jpg';

      const result = await saveNetworkMap({
        downloadUrl: mapService.getProxyFileUrl(family, 'image', network),
        extension,
        family,
        network,
        networkName,
      });
      if (feedbackAllowed.current) {
        if (result === 'saved') haptics.success();
        else if (result === 'permission-denied') haptics.warning();
      }
    } catch {
      if (feedbackAllowed.current) haptics.error();
      notifyMapSaveFailed();
    } finally {
      downloadInFlight.current = false;
      setDownloading(false);
    }
  };

  if (loading) return <LoadingState message="Loading map..." />;
  if (failed) {
    return <ErrorState message="Could not load map data" onRetry={refetch} />;
  }

  // BMRC publishes both maps; the API proxies their bytes so the app never
  // asks the operator's CDN directly.
  const remoteImageUrl = data?.image
    ? mapService.getProxyFileUrl(family, 'image', network)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {isOfflineCopy ? (
        <OfflineNote inset message="Saved map. It opens from the copy stored on this device." />
      ) : null}
      <View style={styles.familyRow} pointerEvents="box-none">
        {FAMILIES.map((item) => {
          const active = item.key === family;
          return (
            <Touchable
              key={item.key}
              radius={radius.pill}
              haptic="select"
              onPress={() => setFamily(item.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show the ${item.label}`}
              style={{
                backgroundColor: active ? theme.colors.primary : fills.containerHigh,
              }}
            >
              <View style={styles.familyChip}>
                <Text
                  variant="labelLarge"
                  style={[
                    emphasis.strong,
                    { color: active ? theme.colors.onPrimary : theme.colors.onSurface },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </Touchable>
          );
        })}
      </View>
      <GestureDetector gesture={gestures} touchAction="none">
        <View ref={canvasRef} style={styles.canvas} onLayout={handleCanvasLayout}>
          {remoteImageUrl ? (
            <HighResolutionMapImage
              key={remoteImageUrl}
              uri={remoteImageUrl}
              imageStyle={imageStyle}
              onSize={handleImageSize}
            />
          ) : (
            <EmptyState
              title="Map unavailable"
              subtitle="The complete network map is not available right now"
              icon="map-outline"
            />
          )}
        </View>
      </GestureDetector>

      <Surface
        style={[styles.zoomControls, { bottom: insets.bottom + spacing['2xl'] }]}
        elevation={3}
      >
        <Touchable
          radius={radius.iconSmall}
          haptic={false}
          onPress={() => zoomBy(ZOOM_STEP)}
          accessibilityLabel="Zoom in"
          style={{ backgroundColor: fills.floating }}
        >
          <View style={styles.zoomBtn}>
            <Ionicons name="add" size={22} color={theme.colors.onSurface} />
          </View>
        </Touchable>
        <View style={[styles.zoomDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <Touchable
          radius={radius.iconSmall}
          haptic={false}
          onPress={() => zoomBy(-ZOOM_STEP)}
          accessibilityLabel="Zoom out"
          style={{ backgroundColor: fills.floating }}
        >
          <View style={styles.zoomBtn}>
            <Ionicons name="remove" size={22} color={theme.colors.onSurface} />
          </View>
        </Touchable>
      </Surface>

      <FAB
        icon={downloading ? 'progress-download' : 'download'}
        label="Save map"
        loading={downloading}
        disabled={downloading}
        onPress={handleDownloadMap}
        accessibilityLabel={`Save the ${networkName} network map to the device`}
        style={[styles.fab, { bottom: insets.bottom + spacing['2xl'] }]}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  familyRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.base,
    zIndex: 2,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  familyChip: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web' ? { willChange: 'transform' } : {}),
  },
  loader: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.base,
    borderRadius: radius.icon,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm,
  },
  fab: {
    position: 'absolute',
    left: spacing.base,
    borderRadius: radius.icon,
  },
});

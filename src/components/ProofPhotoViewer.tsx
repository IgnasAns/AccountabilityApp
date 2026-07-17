import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Dimensions,
    Pressable,
    Platform,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

interface ProofPhotoViewerProps {
    photoUrl: string | null | undefined;
    size?: 'small' | 'medium';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_SCALE = 4;
const MIN_SCALE = 1;

function ZoomableImage({ uri, onClose }: { uri: string; onClose: () => void }) {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value < 1.1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            }
        });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            }
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withSpring(2);
                savedScale.value = 2;
            }
        });

    const singleTapGesture = Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
            if (scale.value <= 1) {
                runOnJS(onClose)();
            }
        });

    const composedGesture = Gesture.Race(
        Gesture.Simultaneous(pinchGesture, panGesture),
        doubleTapGesture,
        singleTapGesture
    );

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    return (
        <GestureDetector gesture={composedGesture}>
            <Animated.View style={styles.gestureContainer}>
                <Animated.Image
                    source={{ uri }}
                    style={[styles.fullscreenImage, animatedStyle]}
                    resizeMode="contain"
                />
            </Animated.View>
        </GestureDetector>
    );
}

export default function ProofPhotoViewer({ photoUrl, size = 'small' }: ProofPhotoViewerProps) {
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [imageError, setImageError] = useState(false);

    if (!photoUrl || imageError) {
        return null;
    }

    const thumbnailSize = size === 'small' ? 40 : 60;

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowFullscreen(true)}
                style={[
                    styles.thumbnailContainer,
                    { width: thumbnailSize, height: thumbnailSize }
                ]}
            >
                <Image
                    source={{ uri: photoUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                />
                <View style={styles.thumbnailOverlay}>
                    <Text style={styles.cameraIcon}>📷</Text>
                </View>
            </TouchableOpacity>

            <Modal
                visible={showFullscreen}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFullscreen(false)}
                statusBarTranslucent
            >
                <View style={styles.fullscreenContainer}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                    )}

                    <ZoomableImage
                        uri={photoUrl}
                        onClose={() => setShowFullscreen(false)}
                    />

                    <View style={styles.proofBadge}>
                        <Text style={styles.proofBadgeText}>📸 Proof Photo</Text>
                    </View>

                    <View style={styles.zoomHint}>
                        <Text style={styles.zoomHintText}>Pinch to zoom · Double tap to toggle</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowFullscreen(false)}
                    >
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    thumbnailContainer: {
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: colors.primary,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary,
        borderTopLeftRadius: 4,
        padding: 2,
    },
    cameraIcon: {
        fontSize: 10,
    },
    fullscreenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
    },
    gestureContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: SCREEN_WIDTH * 0.95,
        height: SCREEN_HEIGHT * 0.7,
    },
    proofBadge: {
        position: 'absolute',
        bottom: 60,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    proofBadgeText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    zoomHint: {
        position: 'absolute',
        bottom: 30,
    },
    zoomHintText: {
        color: colors.textMuted,
        fontSize: 12,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
});

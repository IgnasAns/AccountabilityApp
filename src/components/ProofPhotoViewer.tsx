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
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

interface ProofPhotoViewerProps {
    photoUrl: string | null | undefined;
    size?: 'small' | 'medium';
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
                <Pressable
                    style={styles.fullscreenContainer}
                    onPress={() => setShowFullscreen(false)}
                >
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                    )}

                    <View style={styles.imageWrapper}>
                        <Image
                            source={{ uri: photoUrl }}
                            style={styles.fullscreenImage}
                            resizeMode="contain"
                        />
                        <View style={styles.proofBadge}>
                            <Text style={styles.proofBadgeText}>📸 Proof Photo</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowFullscreen(false)}
                    >
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </Pressable>
            </Modal>
        </>
    );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
    imageWrapper: {
        width: screenWidth * 0.95,
        height: screenHeight * 0.7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: '100%',
        height: '100%',
    },
    proofBadge: {
        position: 'absolute',
        bottom: 20,
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

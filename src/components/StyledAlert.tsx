import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    Animated,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
    title: string;
    message?: string;
    buttons?: AlertButton[];
    icon?: string;
}

interface AlertContextType {
    showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useStyledAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        // If used outside provider, fallback to using the static method
        return {
            showAlert: (config: AlertConfig) => {
                StyledAlert.alert(config.title, config.message, config.buttons);
            }
        };
    }
    return context;
}

// Static alert queue for use outside React components
let staticShowAlert: ((config: AlertConfig) => void) | null = null;

export function AlertProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.9))[0];

    const showAlert = useCallback((alertConfig: AlertConfig) => {
        setConfig(alertConfig);
        setVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 20,
                stiffness: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

    // Register static method
    React.useEffect(() => {
        staticShowAlert = showAlert;
        return () => {
            staticShowAlert = null;
        };
    }, [showAlert]);

    const hideAlert = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setConfig(null);
        });
    }, [fadeAnim, scaleAnim]);

    const handleButtonPress = useCallback((button: AlertButton) => {
        hideAlert();
        // Delay the callback to allow animation to complete
        setTimeout(() => {
            button.onPress?.();
        }, 150);
    }, [hideAlert]);

    const getIcon = () => {
        if (config?.icon) return config.icon;
        const title = config?.title?.toLowerCase() || '';
        if (title.includes('error') || title.includes('failed')) return '❌';
        if (title.includes('success') || title.includes('created') || title.includes('joined')) return '🎉';
        if (title.includes('warning')) return '⚠️';
        if (title.includes('guest')) return '👤';
        if (title.includes('setup') || title.includes('permission')) return '🔧';
        return '💬';
    };

    const getIconBackground = () => {
        const title = config?.title?.toLowerCase() || '';
        if (title.includes('error') || title.includes('failed')) return colors.error;
        if (title.includes('success') || title.includes('created') || title.includes('joined')) return colors.success;
        if (title.includes('warning')) return colors.warning;
        return colors.primary;
    };

    const buttons = config?.buttons || [{ text: 'OK', style: 'default' as const }];

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            <Modal
                visible={visible}
                transparent
                animationType="none"
                onRequestClose={hideAlert}
                statusBarTranslucent
            >
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                    )}
                    <Pressable style={StyleSheet.absoluteFill} onPress={hideAlert} />

                    <Animated.View
                        style={[
                            styles.alertContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            }
                        ]}
                    >
                        <View style={styles.alertContent}>
                            {/* Glow effect behind icon */}
                            <View style={[styles.iconGlow, { backgroundColor: getIconBackground() }]} />

                            {/* Icon */}
                            <View style={[styles.iconContainer, { backgroundColor: `${getIconBackground()}20` }]}>
                                <Text style={styles.iconText}>{getIcon()}</Text>
                            </View>

                            {/* Title */}
                            <Text style={styles.title}>{config?.title}</Text>

                            {/* Message */}
                            {config?.message && (
                                <Text style={styles.message}>{config.message}</Text>
                            )}

                            {/* Buttons */}
                            <View style={[
                                styles.buttonContainer,
                                buttons.length === 1 && styles.singleButtonContainer
                            ]}>
                                {buttons.map((button, index) => {
                                    const isCancel = button.style === 'cancel';
                                    const isDestructive = button.style === 'destructive';

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.button,
                                                buttons.length === 1 && styles.singleButton,
                                                isCancel && styles.cancelButton,
                                                isDestructive && styles.destructiveButton,
                                                !isCancel && !isDestructive && styles.primaryButton,
                                            ]}
                                            onPress={() => handleButtonPress(button)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[
                                                styles.buttonText,
                                                isCancel && styles.cancelButtonText,
                                                !isCancel && styles.primaryButtonText,
                                            ]}>
                                                {button.text}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </AlertContext.Provider>
    );
}

// Static method for use similar to Alert.alert()
export const StyledAlert = {
    alert: (title: string, message?: string, buttons?: AlertButton[]) => {
        if (staticShowAlert) {
            staticShowAlert({ title, message, buttons });
        } else {
            // Fallback to native Alert if provider not mounted
            const nativeAlert = require('react-native').Alert;
            nativeAlert.alert(title, message, buttons);
        }
    }
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    alertContainer: {
        width: '100%',
        maxWidth: 340,
    },
    alertContent: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconGlow: {
        position: 'absolute',
        top: -20,
        width: 100,
        height: 100,
        borderRadius: 50,
        opacity: 0.15,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconText: {
        fontSize: 36,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        color: colors.textMuted,
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    singleButtonContainer: {
        justifyContent: 'center',
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    singleButton: {
        flex: 0,
        minWidth: 140,
    },
    cancelButton: {
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    destructiveButton: {
        backgroundColor: colors.error,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButtonText: {
        color: colors.textMuted,
    },
    primaryButtonText: {
        color: '#ffffff',
    },
});

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
import AppIcon, { AppIconName } from './AppIcon';

interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
    title: string;
    message?: string;
    buttons?: AlertButton[];
    icon?: AppIconName;
}

interface AlertContextType {
    showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useStyledAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        return {
            showAlert: (config: AlertConfig) => {
                StyledAlert.alert(config.title, config.message, config.buttons);
            }
        };
    }
    return context;
}

let staticShowAlert: ((config: AlertConfig) => void) | null = null;

export function AlertProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.96))[0];

    const showAlert = useCallback((alertConfig: AlertConfig) => {
        setConfig(alertConfig);
        setVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 160,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                damping: 22,
                stiffness: 360,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

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
                duration: 130,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.96,
                duration: 130,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setConfig(null);
        });
    }, [fadeAnim, scaleAnim]);

    const handleButtonPress = useCallback((button: AlertButton) => {
        hideAlert();
        setTimeout(() => {
            button.onPress?.();
        }, 150);
    }, [hideAlert]);

    const getIcon = (): AppIconName => {
        if (config?.icon) return config.icon;
        const title = config?.title?.toLowerCase() || '';
        if (title.includes('error') || title.includes('failed')) return 'alert-circle-outline';
        if (title.includes('success') || title.includes('created') || title.includes('joined') || title.includes('updated')) {
            return 'check-circle-outline';
        }
        if (title.includes('warning') || title.includes('slow down')) return 'alert-outline';
        if (title.includes('guest')) return 'account-outline';
        if (title.includes('setup') || title.includes('permission')) return 'cog-outline';
        return 'message-text-outline';
    };

    const getIconColor = () => {
        const title = config?.title?.toLowerCase() || '';
        if (title.includes('error') || title.includes('failed')) return colors.error;
        if (title.includes('success') || title.includes('created') || title.includes('joined') || title.includes('updated')) {
            return colors.success;
        }
        if (title.includes('warning') || title.includes('slow down')) return colors.warning;
        return colors.primary;
    };

    const buttons = config?.buttons || [{ text: 'OK', style: 'default' as const }];
    const iconColor = getIconColor();

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
                            <View style={[styles.iconContainer, { backgroundColor: `${iconColor}18` }]}>
                                <AppIcon name={getIcon()} size={34} color={iconColor} />
                            </View>

                            <Text selectable={false} style={styles.title}>{config?.title}</Text>

                            {config?.message && (
                                <Text selectable={false} style={styles.message}>{config.message}</Text>
                            )}

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
                                            activeOpacity={0.75}
                                        >
                                            <Text selectable={false} style={[
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

export const StyledAlert = {
    alert: (title: string, message?: string, buttons?: AlertButton[]) => {
        if (staticShowAlert) {
            staticShowAlert({ title, message, buttons });
        } else {
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
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
    },
    alertContainer: {
        width: '100%',
        maxWidth: 340,
    },
    alertContent: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
        elevation: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconContainer: {
        width: 58,
        height: 58,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10,
    },
    message: {
        color: colors.textMuted,
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
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
        borderRadius: 10,
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
        shadowOpacity: 0.22,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    cancelButtonText: {
        color: colors.textMuted,
    },
    primaryButtonText: {
        color: '#ffffff',
    },
});

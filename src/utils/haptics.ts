import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Safe haptics wrapper that handles web platform and errors gracefully.
 * Use this instead of direct Haptics calls throughout the app.
 */

export type HapticFeedbackType = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'selection';

export const safeHaptics = (type: HapticFeedbackType = 'medium'): void => {
    // Skip haptics on web
    if (Platform.OS === 'web') return;

    try {
        switch (type) {
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            case 'selection':
                Haptics.selectionAsync();
                break;
            default:
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    } catch (e) {
        // Silently ignore haptics errors
    }
};

// Convenience shortcuts
export const hapticSuccess = () => safeHaptics('success');
export const hapticWarning = () => safeHaptics('warning');
export const hapticError = () => safeHaptics('error');
export const hapticLight = () => safeHaptics('light');
export const hapticMedium = () => safeHaptics('medium');
export const hapticHeavy = () => safeHaptics('heavy');
export const hapticSelection = () => safeHaptics('selection');

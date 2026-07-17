/**
 * Application Constants
 *
 * Central location for all app-wide constants.
 * Configuration values that might change between environments
 * should be in src/config/env.ts instead.
 */

// ============ Pagination ============
export const DEFAULT_PAGE_SIZE = 25;
export const MESSAGES_PAGE_SIZE = 50;
export const ACTIVITY_PAGE_SIZE = 50;
export const GOALS_PAGE_SIZE = 20;

// ============ Timeouts ============
export const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
export const UPLOAD_TIMEOUT_MS = 60000; // 60 seconds for image uploads
export const DEBOUNCE_MS = 300; // Input debounce delay

// ============ Chat ============
export const CHAT_MESSAGE_MAX_LENGTH = 300;
export const CHAT_TYPING_INDICATOR_DURATION = 3000; // 3 seconds

// ============ Input Limits ============
export const MAX_NAME_LENGTH = 50;
export const MAX_GROUP_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_COMMENT_LENGTH = 300;
export const MIN_PASSWORD_LENGTH = 6;

// ============ Currency ============
export const CURRENCY_SYMBOL = '€';
export const CURRENCY_CODE = 'EUR';
export const MIN_PENALTY = 0.01;
export const MAX_PENALTY = 10000;

// ============ Images ============
export const MAX_IMAGE_WIDTH = 1200; // Max width after compression
export const IMAGE_QUALITY = 0.7; // JPEG compression quality
export const AVATAR_SIZE = 200; // Avatar dimensions

// ============ Goals ============
export const MIN_GOAL_FREQUENCY_DAYS = 1;
export const MAX_GOAL_FREQUENCY_DAYS = 365;
export const MAX_TARGET_PER_WEEK = 7;

// ============ UI ============
export const ANIMATION_DURATION_SHORT = 200;
export const ANIMATION_DURATION_MEDIUM = 300;
export const ANIMATION_DURATION_LONG = 500;
export const TOAST_DURATION = 3000; // 3 seconds

// ============ Streaks ============
export const STREAK_THRESHOLDS = {
    BRONZE: 7,
    SILVER: 30,
    GOLD: 100,
    PLATINUM: 365,
} as const;

// ============ Leaderboard ============
export const LEADERBOARD_PAGE_SIZE = 50;
export const POINTS_PER_COMPLETION = 10;
export const POINTS_PER_FAILURE = -5;
export const POINTS_STREAK_BONUS_MULTIPLIER = 1.5;

// ============ Error Messages ============
export const ERROR_MESSAGES = {
    NETWORK: 'Connection failed. Check your internet and try again.',
    TIMEOUT: 'Request timed out. Please try again.',
    UNAUTHORIZED: 'Session expired. Please log in again.',
    GENERIC: 'Something went wrong. Please try again.',
    RATE_LIMITED: 'Too many requests. Please wait a moment.',
    GROUP_NOT_FOUND: 'Group not found. It may have been deleted.',
    INSUFFICIENT_PERMISSIONS: 'You don\'t have permission for this action.',
} as const;

// ============ Success Messages ============
export const SUCCESS_MESSAGES = {
    GROUP_CREATED: 'Group created! Share the invite code with friends.',
    GROUP_JOINED: 'Welcome to the group!',
    FAILURE_LOGGED: 'Failure logged. Penalties have been applied.',
    DEBT_SETTLED: 'Debt marked as settled.',
    PROFILE_UPDATED: 'Profile updated successfully.',
    MESSAGE_SENT: 'Message sent.',
} as const;

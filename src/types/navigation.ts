/**
 * Type definitions for React Navigation.
 * Provides type safety for navigation params throughout the app.
 */

export type RootStackParamList = {
    // Auth screens
    Login: undefined;
    SignUp: undefined;

    // Main tabs
    MainTabs: undefined;
    HomeTab: undefined;
    ExploreTab: undefined;
    AddTab: undefined;
    ActivityTab: undefined;
    ProfileTab: undefined;

    // Stack screens
    CreateGroup: {
        initialName?: string;
        initialDescription?: string;
        initialPenalty?: string;
    } | undefined;
    JoinGroup: undefined;
    GroupDetail: { groupId: string };
    GroupChat: { groupId: string; groupName: string };
};

// Type helper for useNavigation hook
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList { }
    }
}

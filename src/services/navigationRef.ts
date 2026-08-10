import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * App-wide navigation handle.
 *
 * Lives in its own module (not App.tsx) so non-component code — notification
 * tap routing in useNotifications, deep-link handling — can navigate without
 * importing App.tsx. Importing App.tsx from a hook created a module cycle
 * (App -> useNotifications -> App) that produced a "Require cycle" warning
 * in the startup logcat. App.tsx re-exports both symbols so any existing
 * consumer keeps working.
 */
export type RootStackParamList = {
    MainTabs: undefined;
    CreateGroup: { initialName?: string; initialDescription?: string; initialPenalty?: string } | undefined;
    JoinGroup: { inviteCode?: string } | undefined;
    GroupDetail: { groupId: string; showInviteModal?: boolean };
    GroupChat: { groupId: string; groupName: string };
    ChangePassword: undefined;
    ResetPassword: undefined;
    Login: undefined;
    SignUp: undefined;
    ForgotPassword: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

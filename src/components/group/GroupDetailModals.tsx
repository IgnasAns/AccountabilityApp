import React from 'react';
import LogFailureModal from '../LogFailureModal';
import ConfirmModal from '../ConfirmModal';
import MemberDetailModal from '../MemberDetailModal';
import GoalCompletionDetailModal from '../GoalCompletionDetailModal';
import { GroupMemberWithProfile, ActivityLogWithProfile } from '../../types/database';

interface GroupDetailModalsProps {
    // Failure modal
    showFailureModal: boolean;
    onFailureClose: () => void;
    onFailureSuccess: () => void;
    groupId: string;
    groupName: string;
    penaltyAmount: number;
    memberCount: number;

    // Delete modal
    showDeleteModal: boolean;
    onDeleteConfirm: () => void;
    onDeleteCancel: () => void;
    isDeleting: boolean;

    // Leave modal
    showLeaveModal: boolean;
    onLeaveConfirm: () => void;
    onLeaveCancel: () => void;

    // Member detail modal
    showMemberModal: boolean;
    selectedMember: GroupMemberWithProfile | null;
    onMemberClose: () => void;
    currentUserId: string;
    groupCreatorId: string;

    // Completion detail modal
    showCompletionModal: boolean;
    selectedActivity: ActivityLogWithProfile | null;
    onCompletionClose: () => void;
}

export default function GroupDetailModals({
    showFailureModal,
    onFailureClose,
    onFailureSuccess,
    groupId,
    groupName,
    penaltyAmount,
    memberCount,
    showDeleteModal,
    onDeleteConfirm,
    onDeleteCancel,
    isDeleting,
    showLeaveModal,
    onLeaveConfirm,
    onLeaveCancel,
    showMemberModal,
    selectedMember,
    onMemberClose,
    currentUserId,
    groupCreatorId,
    showCompletionModal,
    selectedActivity,
    onCompletionClose,
}: GroupDetailModalsProps) {
    return (
        <>
            <LogFailureModal
                visible={showFailureModal}
                onClose={onFailureClose}
                onSuccess={onFailureSuccess}
                groupId={groupId}
                groupName={groupName}
                penaltyAmount={penaltyAmount}
                memberCount={memberCount}
            />

            <ConfirmModal
                visible={showDeleteModal}
                title="Delete Group"
                message="Are you sure you want to delete this group? This cannot be undone."
                confirmText="Delete"
                onConfirm={onDeleteConfirm}
                onCancel={onDeleteCancel}
                loading={isDeleting}
                confirmStyle="danger"
            />

            <ConfirmModal
                visible={showLeaveModal}
                title="Leave Group"
                message="Are you sure you want to leave this group?"
                confirmText="Leave"
                onConfirm={onLeaveConfirm}
                onCancel={onLeaveCancel}
                loading={isDeleting}
                confirmStyle="danger"
            />

            <MemberDetailModal
                visible={showMemberModal}
                member={selectedMember}
                onClose={onMemberClose}
                isCurrentUser={selectedMember?.user_id === currentUserId}
                groupCreatorId={groupCreatorId}
            />

            <GoalCompletionDetailModal
                visible={showCompletionModal}
                activityItem={selectedActivity}
                onClose={onCompletionClose}
            />
        </>
    );
}

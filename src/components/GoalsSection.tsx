import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { useGoals } from '../hooks/useGoals';
import GoalCard from './GoalCard';
import CreateGoalModal from './CreateGoalModal';
import GoalCalendarModal from './GoalCalendarModal';
import CompleteGoalModal from './CompleteGoalModal';
import { StyledAlert } from './StyledAlert';
import { GoalWithCompletions } from '../types/database';
import { colors } from '../theme/colors';

interface Props {
    groupId: string;
    groupName: string;
    defaultPenalty: number;
    groupMembers?: { id: string; name: string }[];
    onMemberPress: (userId: string) => void;
}

export default function GoalsSection({ groupId, groupName, defaultPenalty, groupMembers = [], onMemberPress }: Props) {
    const {
        goals,
        loading,
        error,
        createGoal,
        logCompletion,
        logNegativeOccurrence,
        getGoalStatus,
        refetch,
    } = useGoals(groupId);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<GoalWithCompletions | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [goalToComplete, setGoalToComplete] = useState<GoalWithCompletions | null>(null);

    const handleCreateGoal = async (
        name: string,
        emoji: string,
        goalMode: 'positive' | 'negative',
        frequencyDays: number,
        penaltyAmount: number,
        targetPerWeek: number | null,
        description?: string
    ) => {
        try {
            await createGoal({
                name,
                emoji,
                frequencyDays,
                penaltyAmount,
                description,
                goalType: 'frequency',
                goalMode,
                targetPerWeek,
            });
            const modeText = goalMode === 'positive' ? 'Goal' : 'Tracker';
            StyledAlert.alert(`${modeText} Created! 🎯`, `"${name}" has been added to the group.`);
        } catch (err: any) {
            StyledAlert.alert('Error', err.message);
            throw err;
        }
    };

    // Opens the completion modal (photo required)
    const handleComplete = async (goalId: string) => {
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
            setGoalToComplete(goal);
            setShowCompleteModal(true);
        }
    };

    // Called when completion modal submits with photo
    const handleSubmitCompletion = async (goalId: string, proofPhotoUrl: string, notes?: string) => {
        try {
            await logCompletion(goalId, proofPhotoUrl, notes);
            const goal = goals.find(g => g.id === goalId);
            StyledAlert.alert('Completed! ✅', `Great job completing "${goal?.name}"!\n\n📸 Photo proof saved.`);
        } catch (err: any) {
            StyledAlert.alert('Error', err.message);
            throw err;
        }
    };

    const handleViewCalendar = (goalId: string) => {
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
            setSelectedGoal(goal);
            setShowCalendar(true);
        }
    };

    // Handle negative goal logging
    const handleNegativeLog = async (goalId: string, count: number) => {
        try {
            await logNegativeOccurrence(goalId, count);
            const goal = goals.find(g => g.id === goalId);
            StyledAlert.alert(
                'Logged 📝',
                `Slip-up recorded for "${goal?.name}".\n\n€${goal?.penalty_amount.toFixed(2)} penalty applied.`
            );
        } catch (err: any) {
            StyledAlert.alert('Error', err.message);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading goals...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load goals</Text>
                <TouchableOpacity style={styles.retryButton} onPress={refetch}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Section Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>📊 Tasks & Tracking</Text>
                    <Text style={styles.subtitle}>
                        Goals & habit tracking with penalties
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowCreateModal(true)}
                >
                    <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {/* Goals List */}
            {goals.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🎯</Text>
                    <Text style={styles.emptyTitle}>No goals yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Create a goal like "Gym every 3 days" to start tracking
                    </Text>
                    <TouchableOpacity
                        style={styles.createFirstButton}
                        onPress={() => setShowCreateModal(true)}
                    >
                        <Text style={styles.createFirstButtonText}>Create First Goal</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.goalsList}>
                    {goals.map((goal) => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            status={getGoalStatus(goal)}
                            onComplete={handleComplete}
                            onNegativeLog={handleNegativeLog}
                            onViewCalendar={handleViewCalendar}
                        />
                    ))}
                </View>
            )}

            {/* Create Goal Modal */}
            <CreateGoalModal
                visible={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateGoal}
                groupName={groupName}
                defaultPenalty={defaultPenalty}
            />

            {/* Goal Calendar Modal */}
            <GoalCalendarModal
                visible={showCalendar}
                onClose={() => {
                    setShowCalendar(false);
                    setSelectedGoal(null);
                }}
                goal={selectedGoal}
                groupMembers={groupMembers}
                onMemberPress={onMemberPress}
            />

            {/* Complete Goal Modal (with mandatory photo) */}
            <CompleteGoalModal
                visible={showCompleteModal}
                onClose={() => {
                    setShowCompleteModal(false);
                    setGoalToComplete(null);
                }}
                onSubmit={handleSubmitCompletion}
                goal={goalToComplete}
                groupId={groupId}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: colors.surface,
        borderRadius: 16,
    },
    loadingText: {
        color: colors.textMuted,
        marginLeft: 12,
    },
    errorContainer: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: colors.surface,
        borderRadius: 16,
    },
    errorText: {
        color: colors.error,
        marginBottom: 12,
    },
    retryButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: colors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 2,
    },
    addButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    goalsList: {
        gap: 0, // GoalCard has its own marginBottom
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    createFirstButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    createFirstButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

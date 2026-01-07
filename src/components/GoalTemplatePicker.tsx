import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    TextInput,
} from 'react-native';
import { colors } from '../theme/colors';
import { useGoalTemplates } from '../hooks/useGoalTemplates';
import { GoalTemplate, GoalCategory } from '../types/database';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelectTemplate: (template: GoalTemplate) => void;
}

export default function GoalTemplatePicker({ visible, onClose, onSelectTemplate }: Props) {
    const {
        templates,
        loading,
        getFeatured,
        getByCategory,
        getByMode,
        search,
        getCategoryInfo,
        getAllCategories,
    } = useGoalTemplates();

    const [selectedCategory, setSelectedCategory] = useState<GoalCategory | 'all' | 'featured'>('featured');
    const [searchQuery, setSearchQuery] = useState('');

    const getDisplayedTemplates = (): GoalTemplate[] => {
        if (searchQuery.trim()) {
            return search(searchQuery);
        }
        if (selectedCategory === 'featured') {
            return getFeatured();
        }
        if (selectedCategory === 'all') {
            return templates;
        }
        return getByCategory(selectedCategory);
    };

    const displayedTemplates = getDisplayedTemplates();

    const handleSelect = (template: GoalTemplate) => {
        onSelectTemplate(template);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContent}>
                    {/* Handle bar */}
                    <View style={styles.handleBarContainer}>
                        <View style={styles.handleBar} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Choose a Template</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search templates..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Text style={styles.clearSearch}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Category Tabs */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryScroll}
                        contentContainerStyle={styles.categoryContainer}
                    >
                        <TouchableOpacity
                            style={[
                                styles.categoryTab,
                                selectedCategory === 'featured' && styles.categoryTabActive,
                            ]}
                            onPress={() => setSelectedCategory('featured')}
                        >
                            <Text style={styles.categoryEmoji}>⭐</Text>
                            <Text style={[
                                styles.categoryLabel,
                                selectedCategory === 'featured' && styles.categoryLabelActive,
                            ]}>Featured</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.categoryTab,
                                selectedCategory === 'all' && styles.categoryTabActive,
                            ]}
                            onPress={() => setSelectedCategory('all')}
                        >
                            <Text style={styles.categoryEmoji}>📋</Text>
                            <Text style={[
                                styles.categoryLabel,
                                selectedCategory === 'all' && styles.categoryLabelActive,
                            ]}>All</Text>
                        </TouchableOpacity>

                        {getAllCategories().filter(c => c !== 'custom').map((category) => {
                            const info = getCategoryInfo(category);
                            return (
                                <TouchableOpacity
                                    key={category}
                                    style={[
                                        styles.categoryTab,
                                        selectedCategory === category && styles.categoryTabActive,
                                    ]}
                                    onPress={() => setSelectedCategory(category)}
                                >
                                    <Text style={styles.categoryEmoji}>{info.emoji}</Text>
                                    <Text style={[
                                        styles.categoryLabel,
                                        selectedCategory === category && styles.categoryLabelActive,
                                    ]}>{info.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Templates Grid */}
                    <ScrollView
                        style={styles.templatesList}
                        showsVerticalScrollIndicator={false}
                    >
                        {displayedTemplates.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyIcon}>🔍</Text>
                                <Text style={styles.emptyText}>No templates found</Text>
                            </View>
                        ) : (
                            displayedTemplates.map((template) => (
                                <TouchableOpacity
                                    key={template.id}
                                    style={[
                                        styles.templateCard,
                                        template.goal_mode === 'negative' && styles.templateCardNegative,
                                    ]}
                                    onPress={() => handleSelect(template)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[
                                        styles.templateEmoji,
                                        template.goal_mode === 'negative' && styles.templateEmojiNegative,
                                    ]}>
                                        <Text style={styles.emoji}>{template.emoji}</Text>
                                    </View>
                                    <View style={styles.templateInfo}>
                                        <Text style={styles.templateName}>{template.name}</Text>
                                        <Text style={styles.templateDescription} numberOfLines={1}>
                                            {template.description}
                                        </Text>
                                        <View style={styles.templateMeta}>
                                            <View style={[
                                                styles.modeBadge,
                                                template.goal_mode === 'negative' && styles.modeBadgeNegative,
                                            ]}>
                                                <Text style={styles.modeBadgeText}>
                                                    {template.goal_mode === 'positive' ? '✅ Build' : '🚫 Break'}
                                                </Text>
                                            </View>
                                            <Text style={styles.penaltyText}>
                                                €{template.suggested_penalty.toFixed(2)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={styles.selectArrow}>→</Text>
                                </TouchableOpacity>
                            ))
                        )}

                        {/* Bottom padding */}
                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    handleBarContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: colors.textMuted,
        fontSize: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceHighlight,
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: colors.text,
        fontSize: 15,
    },
    clearSearch: {
        color: colors.textMuted,
        fontSize: 14,
        padding: 4,
    },
    categoryScroll: {
        maxHeight: 50,
    },
    categoryContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },
    categoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surfaceHighlight,
        gap: 6,
    },
    categoryTabActive: {
        backgroundColor: colors.primary,
    },
    categoryEmoji: {
        fontSize: 14,
    },
    categoryLabel: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: '500',
    },
    categoryLabelActive: {
        color: '#fff',
    },
    templatesList: {
        flex: 1,
        padding: 20,
    },
    templateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    templateCardNegative: {
        borderColor: colors.error + '30',
    },
    templateEmoji: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: colors.success + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    templateEmojiNegative: {
        backgroundColor: colors.error + '15',
    },
    emoji: {
        fontSize: 24,
    },
    templateInfo: {
        flex: 1,
    },
    templateName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    templateDescription: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 6,
    },
    templateMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    modeBadge: {
        backgroundColor: colors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    modeBadgeNegative: {
        backgroundColor: colors.error + '20',
    },
    modeBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.text,
    },
    penaltyText: {
        fontSize: 11,
        color: colors.textMuted,
    },
    selectArrow: {
        fontSize: 18,
        color: colors.primary,
        marginLeft: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 15,
        color: colors.textMuted,
    },
});

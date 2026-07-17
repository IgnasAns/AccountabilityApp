import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { colors } from '../theme/colors';

interface DataPoint {
    user_id: string;
    user_name: string;
    day_date: string;
    count: number;
}

interface MemberLine {
    user_id: string;
    user_name: string;
    color: string;
    data: { date: string; count: number }[];
}

interface Props {
    allMembersData: DataPoint[];
    goalMode: 'positive' | 'negative';
    label?: string; // e.g., "chapters", "cigarettes"
}

// Color palette for different members
const MEMBER_COLORS = [
    colors.primary,
    colors.accent,
    colors.warning,
    colors.success,
    '#A78BFA',
    '#F472B6',
    '#93C5FD',
    '#FB7185',
];

export default function GoalStatsGraph({ allMembersData, goalMode, label }: Props) {
    // Get last 7 days
    const getLast7Days = (): string[] => {
        const days: string[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            days.push(date.toISOString().split('T')[0]);
        }
        return days;
    };

    const days = getLast7Days();
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    // Get current day of week (0 = Sunday)
    const todayDayOfWeek = new Date().getDay();
    const orderedDayLabels: string[] = [];
    for (let i = 6; i >= 0; i--) {
        const dayIndex = (todayDayOfWeek - i + 7) % 7;
        // Convert Sunday=0 to Monday=0 format
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        orderedDayLabels.push(dayLabels[adjustedIndex]);
    }

    // Group data by user
    const memberLines: MemberLine[] = [];
    const userMap = new Map<string, { name: string; dataMap: Map<string, number> }>();

    allMembersData.forEach((dp) => {
        if (!userMap.has(dp.user_id)) {
            userMap.set(dp.user_id, { name: dp.user_name, dataMap: new Map() });
        }
        const existing = userMap.get(dp.user_id)!.dataMap.get(dp.day_date) || 0;
        userMap.get(dp.user_id)!.dataMap.set(dp.day_date, existing + dp.count);
    });

    let colorIndex = 0;
    userMap.forEach((value, key) => {
        const data = days.map((date) => ({
            date,
            count: value.dataMap.get(date) || 0,
        }));
        memberLines.push({
            user_id: key,
            user_name: value.name,
            color: MEMBER_COLORS[colorIndex % MEMBER_COLORS.length],
            data,
        });
        colorIndex++;
    });

    // Find max value for scaling
    const maxValue = Math.max(
        1,
        ...memberLines.flatMap((ml) => ml.data.map((d) => d.count))
    );

    const graphHeight = 100;
    const graphPadding = 10; // Padding to prevent overflow
    const graphWidth = Dimensions.get('window').width - 140; // More margin for safety
    const pointSpacing = graphWidth / 6; // 7 points, 6 gaps

    // Render a single line
    const renderLine = (line: MemberLine, index: number) => {
        const usableHeight = graphHeight - graphPadding * 2; // Leave padding top/bottom
        const points = line.data.map((d, i) => ({
            x: i * pointSpacing,
            y: graphPadding + usableHeight - (d.count / maxValue) * usableHeight,
            count: d.count,
        }));

        return (
            <View key={line.user_id} style={StyleSheet.absoluteFill}>
                {/* Line segments */}
                {points.map((point, i) => {
                    if (i === 0) return null;
                    const prev = points[i - 1];
                    const dx = point.x - prev.x;
                    const dy = point.y - prev.y;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                    return (
                        <View
                            key={`line-${i}`}
                            style={[
                                styles.lineSegment,
                                {
                                    width: length,
                                    backgroundColor: line.color,
                                    left: prev.x + 8,
                                    top: prev.y + 4,
                                    transform: [{ rotate: `${angle}deg` }],
                                    opacity: 0.8,
                                },
                            ]}
                        />
                    );
                })}

                {/* Data points */}
                {points.map((point, i) => (
                    <View
                        key={`point-${i}`}
                        style={[
                            styles.dataPoint,
                            {
                                left: point.x + 4,
                                top: point.y,
                                backgroundColor: line.color,
                            },
                        ]}
                    />
                ))}
            </View>
        );
    };

    if (memberLines.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No data yet for the last 7 days</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Title */}
            <Text style={styles.title}>Last 7 Days</Text>

            {/* Y-axis labels */}
            <View style={styles.graphContainer}>
                <View style={styles.yAxis}>
                    <Text style={styles.yLabel}>{maxValue}</Text>
                    <Text style={styles.yLabel}>{Math.floor(maxValue / 2)}</Text>
                    <Text style={styles.yLabel}>0</Text>
                </View>

                {/* Graph area */}
                <View style={[styles.graphArea, { height: graphHeight }]}>
                    {/* Grid lines */}
                    <View style={[styles.gridLine, { top: graphPadding }]} />
                    <View style={[styles.gridLine, { top: graphHeight / 2 }]} />
                    <View style={[styles.gridLine, { top: graphHeight - graphPadding }]} />

                    {/* Clipped container for lines */}
                    <View style={styles.graphClip}>
                        {memberLines.map((line, index) => renderLine(line, index))}
                    </View>
                </View>
            </View>

            {/* X-axis labels */}
            <View style={styles.xAxis}>
                {orderedDayLabels.map((label, i) => (
                    <Text key={i} style={styles.xLabel}>{label}</Text>
                ))}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                {memberLines.map((line) => (
                    <View key={line.user_id} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: line.color }]} />
                        <Text style={styles.legendText} numberOfLines={1}>
                            {line.user_name}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 16,
        marginVertical: 12,
    },
    title: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
        marginBottom: 16,
    },
    graphContainer: {
        flexDirection: 'row',
    },
    yAxis: {
        width: 30,
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingRight: 8,
    },
    yLabel: {
        color: colors.textMuted,
        fontSize: 10,
    },
    graphArea: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    graphClip: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    gridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: colors.border,
    },
    lineSegment: {
        position: 'absolute',
        height: 2,
        borderRadius: 1,
        transformOrigin: 'left center',
    },
    dataPoint: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    xAxis: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 34,
        paddingRight: 4,
        marginTop: 8,
    },
    xLabel: {
        color: colors.textMuted,
        fontSize: 11,
        fontWeight: '500',
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 16,
        gap: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 6,
    },
    legendText: {
        color: colors.textMuted,
        fontSize: 12,
        maxWidth: 80,
    },
    emptyContainer: {
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 13,
    },
});

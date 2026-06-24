import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';

const LOCATION_COLOR = {
  Remote: { bg: colors.secondaryLight, text: colors.secondary },
  Hybrid: { bg: colors.warningLight, text: colors.warning },
  'On-site': { bg: colors.primaryLight, text: colors.primary },
};

export default function JobCard({ job, onPress, onSave, style }) {
  const locStyle = LOCATION_COLOR[job.locationType] ?? LOCATION_COLOR['On-site'];

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress(job)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          <Text style={styles.logo}>{job.companyLogo}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.company} numberOfLines={1}>{job.company}</Text>
          <Text style={styles.postedAt}>{job.postedAt}</Text>
        </View>
        <TouchableOpacity onPress={() => onSave(job.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.saveIcon, job.saved && styles.saveIconActive]}>
            {job.saved ? '❤️' : '🤍'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>{job.title}</Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>📍 {job.location}</Text>
        <View style={[styles.badge, { backgroundColor: locStyle.bg }]}>
          <Text style={[styles.badgeText, { color: locStyle.text }]}>{job.locationType}</Text>
        </View>
      </View>

      {/* Footer row */}
      <View style={styles.footer}>
        <Text style={styles.salary}>{job.salary}</Text>
        <View style={styles.typeChip}>
          <Text style={styles.typeText}>{job.type}</Text>
        </View>
        {job.applied && (
          <View style={styles.appliedChip}>
            <Text style={styles.appliedText}>Applied ✓</Text>
          </View>
        )}
      </View>

      {/* Tags */}
      <View style={styles.tags}>
        {job.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  logo: {
    fontSize: 22,
  },
  headerText: {
    flex: 1,
  },
  company: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  postedAt: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  saveIcon: {
    fontSize: 20,
  },
  saveIconActive: {
    // emoji handles its own color
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  salary: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    flex: 1,
  },
  typeChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  typeText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  appliedChip: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  appliedText: {
    fontSize: fontSize.xs,
    color: colors.secondary,
    fontWeight: fontWeight.medium,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});

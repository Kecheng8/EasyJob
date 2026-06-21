import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useJobs } from '../context/JobsContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';

const LOCATION_COLOR = {
  Remote: { bg: colors.secondaryLight, text: colors.secondary },
  Hybrid: { bg: colors.warningLight, text: colors.warning },
  'On-site': { bg: colors.primaryLight, text: colors.primary },
};

function Section({ title, children }) {
  return (
    <View style={secStyles.container}>
      <Text style={secStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});

function BulletList({ items }) {
  return items.map((item, i) => (
    <View key={i} style={bStyles.row}>
      <Text style={bStyles.bullet}>•</Text>
      <Text style={bStyles.text}>{item}</Text>
    </View>
  ));
}

const bStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: spacing.xs },
  bullet: { color: colors.primary, fontWeight: fontWeight.bold, marginRight: spacing.sm, fontSize: fontSize.md },
  text: { flex: 1, fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
});

export default function JobDetailScreen({ route, navigation }) {
  const { job } = route.params;
  const { jobs, toggleSave, markApplied } = useJobs();
  const liveJob = jobs.find((j) => j.id === job.id) ?? job;

  const locStyle = LOCATION_COLOR[liveJob.locationType] ?? LOCATION_COLOR['On-site'];

  const handleApply = () => {
    if (liveJob.applied) {
      Alert.alert('Already Applied', 'You have already applied for this position.');
      return;
    }
    Alert.alert(
      'Apply for this job?',
      `Submit your application to ${liveJob.company} for the ${liveJob.title} role.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Now',
          onPress: () => {
            markApplied(liveJob.id);
            Alert.alert('🎉 Application Sent!', `Good luck with your application to ${liveJob.company}!`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Custom header */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Job Details</Text>
        <TouchableOpacity onPress={() => toggleSave(liveJob.id)} style={styles.saveBtn}>
          <Text style={styles.saveIcon}>{liveJob.saved ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Company hero */}
        <View style={styles.hero}>
          <View style={styles.heroLogo}>
            <Text style={styles.heroLogoText}>{liveJob.companyLogo}</Text>
          </View>
          <Text style={styles.heroTitle}>{liveJob.title}</Text>
          <Text style={styles.heroCompany}>{liveJob.company}</Text>
          <View style={styles.heroBadges}>
            <View style={[styles.heroBadge, { backgroundColor: locStyle.bg }]}>
              <Text style={[styles.heroBadgeText, { color: locStyle.text }]}>{liveJob.locationType}</Text>
            </View>
            <View style={styles.heroBadgeOutline}>
              <Text style={styles.heroBadgeOutlineText}>{liveJob.type}</Text>
            </View>
            <View style={styles.heroBadgeOutline}>
              <Text style={styles.heroBadgeOutlineText}>{liveJob.experience}</Text>
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{liveJob.salary}</Text>
            <Text style={styles.statLabel}>Salary</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>📍</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{liveJob.location}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>🕐</Text>
            <Text style={styles.statLabel}>{liveJob.postedAt}</Text>
          </View>
        </View>

        {/* Description */}
        <Section title="About the Role">
          <Text style={styles.description}>{liveJob.description}</Text>
        </Section>

        {/* Responsibilities */}
        <Section title="Responsibilities">
          <BulletList items={liveJob.responsibilities} />
        </Section>

        {/* Requirements */}
        <Section title="Requirements">
          <BulletList items={liveJob.requirements} />
        </Section>

        {/* Benefits */}
        <Section title="Benefits">
          <View style={styles.benefitsGrid}>
            {liveJob.benefits.map((b) => (
              <View key={b} style={styles.benefitItem}>
                <Text style={styles.benefitText}>✅ {b}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Tags */}
        <Section title="Skills">
          <View style={styles.tags}>
            {liveJob.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </Section>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Apply button */}
      <View style={styles.applyBar}>
        <TouchableOpacity
          style={[styles.applyBtn, liveJob.applied && styles.applyBtnApplied]}
          onPress={handleApply}
          activeOpacity={0.85}
        >
          <Text style={styles.applyBtnText}>
            {liveJob.applied ? '✓ Applied' : 'Apply Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  backIcon: {
    fontSize: 20,
    color: colors.textPrimary,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  saveIcon: {
    fontSize: 18,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  heroLogo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroLogoText: {
    fontSize: 36,
  },
  heroTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroCompany: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  heroBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  heroBadgeOutline: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroBadgeOutlineText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  benefitItem: {
    backgroundColor: colors.secondaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  benefitText: {
    fontSize: fontSize.sm,
    color: colors.secondary,
    fontWeight: fontWeight.medium,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tagText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  bottomSpace: {
    height: spacing.xxl,
  },
  applyBar: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.md,
  },
  applyBtnApplied: {
    backgroundColor: colors.secondary,
  },
  applyBtnText: {
    color: colors.textInverse,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useJobs } from '../context/JobsContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';

const SKILLS = ['React Native', 'JavaScript', 'TypeScript', 'Node.js', 'UI/UX'];

function StatCard({ emoji, value, label }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.emoji}>{emoji}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  emoji: { fontSize: 24, marginBottom: spacing.xs },
  value: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primary },
  label: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
});

function MenuRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={menuStyles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={menuStyles.icon}>{icon}</Text>
      <Text style={[menuStyles.label, danger && menuStyles.dangerLabel]}>{label}</Text>
      <Text style={menuStyles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: { fontSize: 20, marginRight: spacing.md, width: 28, textAlign: 'center' },
  label: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary },
  dangerLabel: { color: colors.danger },
  arrow: { fontSize: 20, color: colors.textMuted },
});

export default function ProfileScreen() {
  const { jobs } = useJobs();
  const savedCount = jobs.filter((j) => j.saved).length;
  const appliedCount = jobs.filter((j) => j.applied).length;

  const handleNotImplemented = () => {
    Alert.alert('Coming Soon', 'This feature will be available in the next update.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>JD</Text>
          </View>
          <Text style={styles.name}>Jane Doe</Text>
          <Text style={styles.role}>Senior Software Engineer</Text>
          <TouchableOpacity style={styles.editBtn} onPress={handleNotImplemented}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard emoji="❤️" value={savedCount} label="Saved Jobs" />
          <View style={styles.statGap} />
          <StatCard emoji="📝" value={appliedCount} label="Applied" />
          <View style={styles.statGap} />
          <StatCard emoji="👀" value="24" label="Profile Views" />
        </View>

        {/* Resume card */}
        <View style={styles.resumeCard}>
          <View style={styles.resumeLeft}>
            <Text style={styles.resumeIcon}>📄</Text>
            <View>
              <Text style={styles.resumeTitle}>My Resume</Text>
              <Text style={styles.resumeSubtitle}>Jane_Doe_Resume.pdf</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.resumeBtn} onPress={handleNotImplemented}>
            <Text style={styles.resumeBtnText}>Update</Text>
          </TouchableOpacity>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skills}>
            {SKILLS.map((skill) => (
              <View key={skill} style={styles.skillChip}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.addSkillChip} onPress={handleNotImplemented}>
              <Text style={styles.addSkillText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuRow icon="🔔" label="Notifications" onPress={handleNotImplemented} />
            <MenuRow icon="🔒" label="Privacy & Security" onPress={handleNotImplemented} />
            <MenuRow icon="🎨" label="Appearance" onPress={handleNotImplemented} />
            <MenuRow icon="❓" label="Help & Support" onPress={handleNotImplemented} />
            <MenuRow icon="🚪" label="Sign Out" onPress={handleNotImplemented} danger />
          </View>
        </View>

        <Text style={styles.version}>EasyJob v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  name: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  role: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  editBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  editBtnText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  statGap: {
    width: spacing.sm,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  resumeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  resumeIcon: {
    fontSize: 28,
  },
  resumeTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  resumeSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  resumeBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  resumeBtnText: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  skillText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  addSkillChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addSkillText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});

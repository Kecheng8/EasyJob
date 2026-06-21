/** Small shared components: freshness dot, match bar, job card. */
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { T, mono, freshLabel, freshColor } from "../theme";
import type { Job } from "../api/client";

export function FreshDot({ days }: { days: number | null }) {
  return <View style={[styles.dot, { backgroundColor: freshColor(days) }]} />;
}

export function MatchBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? T.gate : pct >= 75 ? T.amber : T.sub;
  return (
    <View style={styles.matchRow}>
      <View style={styles.matchTrack}>
        <View style={[styles.matchFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.matchPct}>{pct}%</Text>
    </View>
  );
}

export function JobCard({
  job,
  onPress,
  onSave,
}: {
  job: Job;
  onPress: () => void;
  onSave: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.sub}>
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </Text>
        </View>
        {job.tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{job.tag}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <FreshDot days={job.days_ago} />
          <Text style={styles.metaText}>{freshLabel(job.days_ago)}</Text>
          <Text style={styles.sep}>|</Text>
          <Text style={[styles.metaText, { fontFamily: mono }]}>{job.source}</Text>
        </View>
        <MatchBar pct={job.match_score} />
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.comp}>{job.comp ?? "Comp not listed"}</Text>
        {job.stage ? (
          <Text style={styles.stage}>● {job.stage}</Text>
        ) : (
          <Pressable onPress={onSave} style={styles.saveBtn}>
            <Text style={styles.saveText}>+ Save</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  matchTrack: { height: 6, width: 64, borderRadius: 3, backgroundColor: T.line, overflow: "hidden" },
  matchFill: { height: "100%", borderRadius: 3 },
  matchPct: { fontSize: 11, fontWeight: "600", color: T.ink, fontFamily: mono },
  card: { backgroundColor: T.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.line, marginBottom: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "700", color: T.ink, lineHeight: 20 },
  sub: { fontSize: 13, color: T.sub, marginTop: 2 },
  tag: { backgroundColor: T.chip, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 10, fontWeight: "700", color: T.gateDark, textTransform: "uppercase", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  metaLeft: { flexDirection: "row", alignItems: "center" },
  metaText: { fontSize: 12, color: T.sub },
  sep: { marginHorizontal: 8, color: T.line },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  comp: { fontSize: 13, fontWeight: "600", color: T.ink, fontFamily: mono },
  stage: { fontSize: 12, fontWeight: "700" },
  saveBtn: { backgroundColor: T.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  saveText: { fontSize: 12, fontWeight: "700", color: T.lime },
});

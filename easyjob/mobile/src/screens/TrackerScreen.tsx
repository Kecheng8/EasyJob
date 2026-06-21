/** Tracker screen — the application pipeline, Saved → Applied → Interview → Offer. */
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { T, STAGES, STAGE_COLOR, freshLabel } from "../theme";
import {
  getApplications,
  setStage,
  removeApplication,
  type Job,
  type Stage,
} from "../api/client";

export default function TrackerScreen({ userId }: { userId: string }) {
  const [apps, setApps] = useState<Job[]>([]);

  const load = useCallback(async () => {
    const { applications } = await getApplications(userId);
    setApps(applications);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (job: Job, stage: Stage) => {
    await setStage(userId, job.id, stage);
    setApps((p) => p.map((j) => (j.id === job.id ? { ...j, stage } : j)));
  };

  const drop = async (job: Job) => {
    await removeApplication(userId, job.id);
    setApps((p) => p.filter((j) => j.id !== job.id));
  };

  const countFor = (s: string) => apps.filter((j) => j.stage === s).length;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <Text style={styles.intro}>
        Your pipeline. Tap a stage to advance an application.
      </Text>

      <View style={styles.summary}>
        {STAGES.map((s) => (
          <View key={s} style={styles.summaryCell}>
            <Text style={[styles.summaryNum, { color: STAGE_COLOR[s] }]}>{countFor(s)}</Text>
            <Text style={styles.summaryLabel}>{s}</Text>
          </View>
        ))}
      </View>

      {apps.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No applications tracked yet.</Text>
          <Text style={styles.emptySub}>Save a role from results to start your pipeline.</Text>
        </View>
      ) : (
        apps.map((job) => (
          <View key={job.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{job.title}</Text>
                <Text style={styles.sub}>
                  {job.company} · {freshLabel(job.days_ago)} · {job.source}
                </Text>
              </View>
              <Pressable onPress={() => drop(job)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
            <View style={styles.stageRow}>
              {STAGES.map((s) => {
                const on = job.stage === s;
                return (
                  <Pressable key={s} onPress={() => advance(job, s)}
                    style={[styles.stageBtn, { backgroundColor: on ? STAGE_COLOR[s] : T.chip }]}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: on ? "#fff" : T.sub }}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  intro: { fontSize: 13, color: T.sub, marginTop: 4, marginBottom: 16 },
  summary: { flexDirection: "row", gap: 8, marginBottom: 20 },
  summaryCell: { flex: 1, backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.line, paddingVertical: 8, alignItems: "center" },
  summaryNum: { fontSize: 16, fontWeight: "800" },
  summaryLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: T.sub, marginTop: 2 },
  empty: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 24 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: T.ink, textAlign: "center" },
  emptySub: { fontSize: 12, color: T.sub, textAlign: "center", marginTop: 4 },
  card: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: 14, fontWeight: "700", color: T.ink },
  sub: { fontSize: 12, color: T.sub, marginTop: 2 },
  remove: { fontSize: 11, fontWeight: "700", color: T.red },
  stageRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  stageBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: "center" },
});

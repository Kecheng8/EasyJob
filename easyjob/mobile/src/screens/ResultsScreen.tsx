/** Results screen — live agent status, then the ranked, gated job list. */
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, RefreshControl } from "react-native";
import { T } from "../theme";
import { JobCard } from "../components/JobCard";
import { getResults, streamRun, setStage, type Job } from "../api/client";

export default function ResultsScreen({
  userId,
  runId,
  gateDays,
  onOpen,
}: {
  userId: string;
  runId: string | null;
  gateDays: number;
  onOpen: (job: Job) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<string>(runId ? "running" : "idle");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { jobs } = await getResults(userId, gateDays);
    setJobs(jobs);
  }, [userId, gateDays]);

  // Subscribe to the agent run; refresh results when it finishes.
  useEffect(() => {
    if (!runId) {
      load();
      return;
    }
    setStatus("running");
    const stop = streamRun(runId, (s) => {
      setStatus(s.status);
      if (s.status === "done") load();
    });
    return stop;
  }, [runId, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const save = async (job: Job) => {
    await setStage(userId, job.id, "Saved");
    setJobs((p) => p.map((j) => (j.id === job.id ? { ...j, stage: "Saved" } : j)));
  };

  if (status === "running") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={T.gate} />
        <Text style={styles.runText}>Agent is searching across sources…</Text>
        <Text style={styles.runSub}>
          Expanding titles, querying ATS boards and the web, deduping, scoring.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.wrap}
      data={jobs}
      keyExtractor={(j) => String(j.id)}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.gate} />}
      ListHeaderComponent={
        <Text style={styles.count}>
          {jobs.length} role{jobs.length === 1 ? "" : "s"} · ≤{gateDays} days
        </Text>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing passes this gate yet.</Text>
          <Text style={styles.emptySub}>
            Widen the freshness window to 15 days or add more titles, then run again.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <JobCard job={item} onPress={() => onOpen(item)} onSave={() => save(item)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  runText: { fontSize: 15, fontWeight: "700", color: T.ink, marginTop: 16 },
  runSub: { fontSize: 13, color: T.sub, textAlign: "center", marginTop: 6, lineHeight: 18 },
  count: { fontSize: 12, fontWeight: "600", color: T.sub, marginVertical: 12 },
  empty: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.line, padding: 24, marginTop: 12 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: T.ink, textAlign: "center" },
  emptySub: { fontSize: 12, color: T.sub, textAlign: "center", marginTop: 4, lineHeight: 18 },
});

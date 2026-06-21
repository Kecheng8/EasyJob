/**
 * EasyJob root. Minimal tab shell tying Search → Results → Tracker together.
 * Keeps a tiny bit of cross-screen state (current run + gate) in memory; the
 * server is the source of truth for everything else.
 */
import React, { useState } from "react";
import { View, Text, Pressable, SafeAreaView, StyleSheet } from "react-native";
import { T } from "./src/theme";
import SearchScreen from "./src/screens/SearchScreen";
import ResultsScreen from "./src/screens/ResultsScreen";
import TrackerScreen from "./src/screens/TrackerScreen";
import type { Job } from "./src/api/client";

const USER_ID = "u_demo"; // replace with real auth

type Tab = "search" | "results" | "tracker";

export default function App() {
  const [tab, setTab] = useState<Tab>("search");
  const [runId, setRunId] = useState<string | null>(null);
  const [gateDays, setGateDays] = useState(10);
  const [detail, setDetail] = useState<Job | null>(null);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Easy<Text style={{ color: T.gate }}>Job</Text>
        </Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>K</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "search" && (
          <SearchScreen
            userId={USER_ID}
            onSearchStarted={(rid, gate) => {
              setRunId(rid);
              setGateDays(gate);
              setTab("results");
            }}
          />
        )}
        {tab === "results" && (
          <ResultsScreen
            userId={USER_ID}
            runId={runId}
            gateDays={gateDays}
            onOpen={setDetail}
          />
        )}
        {tab === "tracker" && <TrackerScreen userId={USER_ID} />}
      </View>

      <View style={styles.tabBar}>
        {(["search", "results", "tracker"] as Tab[]).map((t) => (
          <Pressable key={t} style={styles.tabBtn} onPress={() => setTab(t)}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: tab === t ? T.gate : T.sub }}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {detail && <DetailSheet job={detail} onClose={() => setDetail(null)} />}
    </SafeAreaView>
  );
}

function DetailSheet({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <Pressable style={styles.scrim} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{job.title}</Text>
        <Text style={styles.sheetSub}>
          {job.company} · {job.location ?? "Location n/a"}
        </Text>
        {job.summary ? <Text style={styles.summary}>{job.summary}</Text> : null}
        {job.match_notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesText}>
              <Text style={{ fontWeight: "700" }}>Match notes — </Text>
              {job.match_notes}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  logo: { fontSize: 20, fontWeight: "800", color: T.ink, letterSpacing: -0.5 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.ink, alignItems: "center", justifyContent: "center" },
  avatarText: { color: T.lime, fontWeight: "800", fontSize: 13 },
  tabBar: { flexDirection: "row", backgroundColor: T.card, borderTopWidth: 1, borderTopColor: T.line },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  scrim: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(26,36,33,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: T.line, marginBottom: 16 },
  sheetTitle: { fontSize: 19, fontWeight: "800", color: T.ink },
  sheetSub: { fontSize: 14, color: T.sub, marginTop: 4 },
  summary: { fontSize: 13, lineHeight: 20, color: T.sub, marginTop: 16 },
  notes: { backgroundColor: T.chip, borderRadius: 12, padding: 12, marginTop: 16 },
  notesText: { fontSize: 12, lineHeight: 18, color: T.gateDark },
});

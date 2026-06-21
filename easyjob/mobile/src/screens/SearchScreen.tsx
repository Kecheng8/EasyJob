/** Search screen — titles, industry, and the signature freshness gate. */
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { T, mono } from "../theme";
import { startSearch, type SearchIntent } from "../api/client";

const TITLE_PRESETS = [
  "Lead SDET",
  "Test Automation Lead",
  "QA Automation Lead",
  "QA Engineering Manager",
  "Quality Engineering Lead",
];

const INDUSTRIES = [
  { id: "ai", label: "AI / ML" },
  { id: "fintech", label: "Fintech" },
  { id: "health", label: "Healthtech" },
  { id: "saas", label: "Enterprise SaaS" },
  { id: "auto", label: "Autonomy / Robotics" },
];

const GATES: (3 | 10 | 15)[] = [3, 10, 15];

export default function SearchScreen({
  userId,
  onSearchStarted,
}: {
  userId: string;
  onSearchStarted: (runId: string, gateDays: number) => void;
}) {
  const [titles, setTitles] = useState<string[]>([
    "Lead SDET",
    "Test Automation Lead",
  ]);
  const [industry, setIndustry] = useState<string>("ai");
  const [gate, setGate] = useState<3 | 10 | 15>(10);
  const [busy, setBusy] = useState(false);

  const toggleTitle = (t: string) =>
    setTitles((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const run = async () => {
    setBusy(true);
    try {
      const intent: SearchIntent = {
        user_id: userId,
        titles,
        industries: industry === "all" ? [] : [industry],
        freshness_days: gate,
        locations: ["Remote US", "San Diego, CA"],
      };
      const { run_id } = await startSearch(intent);
      onSearchStarted(run_id, gate);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.intro}>
        Fresh roles only. Pick titles, an industry, and how recent is recent.
      </Text>

      <Text style={styles.label}>Job titles</Text>
      <View style={styles.chipWrap}>
        {TITLE_PRESETS.map((t) => {
          const on = titles.includes(t);
          return (
            <Pressable key={t} onPress={() => toggleTitle(t)}
              style={[styles.chip, { backgroundColor: on ? T.ink : T.chip }]}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: on ? T.lime : T.ink }}>
                {on ? "✓ " : ""}{t}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Industry</Text>
      <View style={styles.chipWrap}>
        {INDUSTRIES.map((ind) => {
          const on = industry === ind.id;
          return (
            <Pressable key={ind.id} onPress={() => setIndustry(on ? "all" : ind.id)}
              style={[styles.indChip, { backgroundColor: on ? T.gate : T.card, borderColor: on ? T.gate : T.line }]}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: on ? "#fff" : T.ink }}>
                {ind.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Signature: the freshness gate */}
      <Text style={styles.label}>Freshness gate</Text>
      <View style={styles.gate}>
        {GATES.map((d) => {
          const on = gate === d;
          return (
            <Pressable key={d} onPress={() => setGate(d)}
              style={[styles.gateBtn, { backgroundColor: on ? T.lime : "transparent" }]}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: on ? T.ink : "#9DB0A8" }}>
                {d}d
              </Text>
              <Text style={{ fontSize: 10, fontWeight: "600", marginTop: 4, color: on ? T.gateDark : "#6E7F78", fontFamily: mono }}>
                published
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Only roles published within this window pass the gate.
      </Text>

      <Pressable onPress={run} disabled={busy || titles.length === 0}
        style={[styles.cta, { opacity: busy || titles.length === 0 ? 0.5 : 1 }]}>
        <Text style={styles.ctaText}>{busy ? "Starting…" : "Run search"}</Text>
      </Pressable>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Sources scanned: Greenhouse · Lever · Ashby · web search · LinkedIn ·
          Indeed. An AI agent expands your titles, judges which companies are
          truly AI, dedups across sources, and ranks by match.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  intro: { fontSize: 13, color: T.sub, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.4, color: T.sub, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  indChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  gate: { backgroundColor: T.ink, borderRadius: 16, padding: 6, flexDirection: "row", gap: 6 },
  gateBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  hint: { fontSize: 11, color: T.sub, marginTop: 8, marginBottom: 24 },
  cta: { backgroundColor: T.gate, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  note: { marginTop: 20, backgroundColor: T.chip, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  noteText: { fontSize: 12, lineHeight: 18, color: T.sub },
});

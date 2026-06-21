/**
 * EasyJob mobile API client.
 *
 * In the hybrid architecture the phone is a thin client: it does NOT open MCP
 * connections itself (those need server credentials and a long-running agent
 * loop). It POSTs a compact search intent to the orchestrator, subscribes to
 * run status, and reads normalized results. This module is the entire network
 * surface of the app.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.easyjob.app";

export type SearchIntent = {
  user_id: string;
  titles: string[];
  industries: string[];
  freshness_days: 3 | 10 | 15;
  locations: string[];
};

export type Job = {
  id: number;
  title: string;
  company: string;
  industry: string | null;
  tag: string | null;
  location: string | null;
  seniority: string | null;
  comp: string | null;
  source: string;
  also_seen_on: string[];
  url: string;
  posted_date: string | null;
  days_ago: number | null;
  match_score: number;
  match_notes: string | null;
  summary: string | null;
  stage: string | null; // null if not in tracker
};

export type Stage = "Saved" | "Applied" | "Interview" | "Offer";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${path}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

/** Kick off a server-side agent search. Returns a run_id to subscribe to. */
export function startSearch(intent: SearchIntent) {
  return req<{ run_id: string; status: string; gate_days: number }>(
    "/v1/search",
    { method: "POST", body: JSON.stringify(intent) }
  );
}

/**
 * Subscribe to run status via SSE. onUpdate fires with each status tick until
 * the run is 'done' or 'error'. Returns an unsubscribe function.
 */
export function streamRun(
  runId: string,
  onUpdate: (s: { status: string; job_count: number }) => void
): () => void {
  const es = new EventSource(`${BASE_URL}/v1/runs/${runId}/stream`);
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    onUpdate(data);
    if (data.status === "done" || data.status === "error") es.close();
  };
  es.onerror = () => es.close();
  return () => es.close();
}

/** Read the latest stored results for a user, filtered to the freshness gate. */
export function getResults(userId: string, gateDays: number) {
  return req<{ jobs: Job[] }>(`/v1/results/${userId}?gate_days=${gateDays}`);
}

/** The application pipeline (tracker). */
export function getApplications(userId: string) {
  return req<{ applications: Job[] }>(`/v1/applications/${userId}`);
}

export function setStage(userId: string, jobId: number, stage: Stage) {
  return req<{ ok: boolean }>("/v1/applications/stage", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, job_id: jobId, stage }),
  });
}

export function removeApplication(userId: string, jobId: number) {
  return req<{ ok: boolean }>(`/v1/applications/${userId}/${jobId}`, {
    method: "DELETE",
  });
}

export function saveProfile(
  userId: string,
  profile: {
    titles: string[];
    industries: string[];
    seniority?: string;
    locations: string[];
  }
) {
  return req<{ ok: boolean }>(`/v1/profile/${userId}`, {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

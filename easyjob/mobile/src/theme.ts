/**
 * EasyJob design tokens. The visual signature is the "quality gate" — borrowed
 * from CI/CD dashboards. Freshness is a first-class control; match scores read
 * like pass rates. Deep evergreen + lime, mono numerals for anything measured.
 */
export const T = {
  bg: "#F5F6F2",
  card: "#FFFFFF",
  ink: "#1A2421",
  sub: "#5C6B66",
  line: "#E3E7E1",
  gate: "#0D7A5F",
  gateDark: "#0A5C48",
  lime: "#C6F432",
  amber: "#E8A33D",
  red: "#D45B5B",
  chip: "#EDF0EA",
  frame: "#121A17",
};

export const STAGES = ["Saved", "Applied", "Interview", "Offer"] as const;

export const STAGE_COLOR: Record<string, string> = {
  Saved: T.sub,
  Applied: T.gate,
  Interview: T.amber,
  Offer: "#7A4DD8",
};

export const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const freshLabel = (d: number | null): string =>
  d == null ? "—" : d === 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;

export const freshColor = (d: number | null): string =>
  d == null ? T.sub : d <= 3 ? T.gate : d <= 10 ? T.amber : T.sub;

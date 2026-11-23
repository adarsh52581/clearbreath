// Indoor default constants – source: DOMAIN_MODEL §5
export const indoorDefaults = {
  // Penetration factor (P)
  P: {
    value: 0.8,
    kind: "assumption" as const,
    source: "Domain model – typical range 0.6–1.0",
  },
  // Air exchange rates by window state (a)
  airExchangeByWindowState: {
    sealed: { value: 0.3, kind: "assumption" as const, source: "Domain model – sealed" },
    closed: { value: 0.6, kind: "assumption" as const, source: "Domain model – closed" },
    partly_open: { value: 2.0, kind: "assumption" as const, source: "Domain model – partly_open" },
    open: { value: 5.0, kind: "assumption" as const, source: "Domain model – open" },
  },
  // Deposition rate (k)
  k: {
    value: 0.2,
    kind: "assumption" as const,
    source: "Domain model – typical range 0.1–0.4",
  },
  // CADR target: 5 air changes per hour (ACH)
  // Formula: recommended CADR (m³/h) = 5 × V
  recommendedCadrAch: {
    ach: 5,
    kind: "reference" as const,
    source: "Domain model – 5 air changes per hour (AHAM rule)",
  },
  // Plant contribution per plant (CADR in m³/h)
  plantCadrPerPlant: {
    value: 0.023,
    kind: "reference" as const,
    source: "Domain model – median single‑plant CADR for VOCs (Cummings & Waring 2020)",
  },
  // CFM to m³/h conversion (1 CFM = 1.699 m³/h)
  cfmToM3hFactor: {
    value: 1.699,
    kind: "reference" as const,
    source: "Domain model – 1 CFM = 1.699 m³/h",
  },
} as const;

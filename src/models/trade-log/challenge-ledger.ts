import {
  CHALLENGE_LEDGER_PHASE_COUNT,
  type Challenge,
} from "./types";

/** French labels matching your tracking sheet (phases 2–7). */
export const LEDGER_PHASE_LABELS_FR = [
  "Phase 2 : Gain/Perte Challenge Jour 1 ($)",
  "Phase 3 : Gain/Perte Challenge Jour 2 ($)",
  "Phase 4 : Gain/Perte Funded Jour 1 ($)",
  "Phase 5 : Gain/Perte Funded Jour 2 ($)",
  "Phase 6 : Gain/Perte Funded Jour 3 ($)",
  "Phase 7 : Gain/Perte Funded Jour 4 ($)",
] as const;

export const LEDGER_PHASE_LABELS_EN = [
  "Evaluation — day 1",
  "Evaluation — day 2",
  "Funded — day 1",
  "Funded — day 2",
  "Funded — day 3",
  "Funded — day 4",
] as const;

export const LEDGER_PHASE_1_LABEL_FR =
  "Phase 1 : Montant Déboursé ($)";
export const LEDGER_PHASE_1_LABEL_EN = "Entry disbursement (fee as cash out)";

export function normalizeLedgerPhases(raw: unknown): (number | null)[] {
  const out: (number | null)[] = [];
  const arr = Array.isArray(raw) ? raw : [];
  for (let i = 0; i < CHALLENGE_LEDGER_PHASE_COUNT; i++) {
    const v = arr[i];
    if (v == null || v === "") {
      out.push(null);
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    out.push(Number.isFinite(n) ? n : null);
  }
  return out;
}

function phase1OutflowAmount(challenge: Challenge): number | null {
  if (challenge.fee > 0) return -Math.abs(challenge.fee);
  return null;
}

function phase1Started(challenge: Challenge): boolean {
  return (
    phase1OutflowAmount(challenge) != null ||
    (challenge.disbursementAt != null && challenge.disbursementAt.trim() !== "")
  );
}

export type LedgerRowView = {
  phase: number;
  labelFr: string;
  labelEn: string;
  value: number | null;
  role: "done" | "next" | "upcoming" | "needs-setup";
};

export type ChallengeLedgerProgress = {
  /** Phase 1 (fee/disbursement) is in play. */
  phase1Started: boolean;
  /** Next column to fill (2–7), or null if all six P&L columns are set. */
  nextPhaseNumber: number | null;
  /** Highest phase with a recorded value (1–7), or 0 if nothing. */
  lastRecordedPhaseNumber: number;
  ledgerTotal: number;
  /** Your note: a negative running total on the sheet = still “open” / ongoing. */
  sheetNegativeOngoing: boolean;
  headlineFr: string;
  detailFr: string;
  headlineEn: string;
  detailEn: string;
  rows: LedgerRowView[];
};

function firstNullPhaseIndex(phases: (number | null)[]): number {
  for (let i = 0; i < CHALLENGE_LEDGER_PHASE_COUNT; i++) {
    if (phases[i] == null) return i;
  }
  return -1;
}

export function getChallengeLedgerProgress(
  challenge: Challenge
): ChallengeLedgerProgress {
  const phases = normalizeLedgerPhases(challenge.ledgerPhases);
  const p1 = phase1Started(challenge);
  const p1Amt = phase1OutflowAmount(challenge);

  const fi = firstNullPhaseIndex(phases);
  const allPhasesFilled = p1 && fi === -1;

  let lastRecorded = 0;
  if (p1Amt != null || challenge.disbursementAt) lastRecorded = 1;
  for (let i = 0; i < CHALLENGE_LEDGER_PHASE_COUNT; i++) {
    if (phases[i] != null) lastRecorded = i + 2;
  }

  let nextPhase: number | null = null;
  if (!p1) {
    nextPhase = 1;
  } else if (fi !== -1) {
    nextPhase = fi + 2;
  }

  let ledgerTotal = 0;
  if (p1Amt != null) ledgerTotal += p1Amt;
  for (const v of phases) {
    if (v != null) ledgerTotal += v;
  }

  const sheetNegativeOngoing = ledgerTotal < 0 && !allPhasesFilled;

  const rows: LedgerRowView[] = [];

  rows.push({
    phase: 1,
    labelFr: LEDGER_PHASE_1_LABEL_FR,
    labelEn: LEDGER_PHASE_1_LABEL_EN,
    value: p1Amt,
    role:
      nextPhase === 1
        ? "next"
        : phase1Started(challenge)
          ? "done"
          : "needs-setup",
  });

  for (let i = 0; i < CHALLENGE_LEDGER_PHASE_COUNT; i++) {
    const phaseNum = i + 2;
    const v = phases[i];
    const role: LedgerRowView["role"] =
      v != null ? "done" : nextPhase === phaseNum ? "next" : "upcoming";

    rows.push({
      phase: phaseNum,
      labelFr: LEDGER_PHASE_LABELS_FR[i],
      labelEn: LEDGER_PHASE_LABELS_EN[i],
      value: v,
      role,
    });
  }

  let headlineFr: string;
  let detailFr: string;
  let headlineEn: string;
  let detailEn: string;

  if (!p1 && phases.every((x) => x == null)) {
    headlineFr = "Feuille — pas encore démarrée";
    detailFr =
      "Renseignez les frais d’entrée, la date du déboursé, puis les phases 2 à 7 dans « Modifier le challenge ».";
    headlineEn = "Ledger — not started";
    detailEn =
      "Set entry fee, disbursement date, then phases 2–7 under Edit challenge.";
  } else if (nextPhase === 1) {
    headlineFr = "Étape : Phase 1 — montant déboursé";
    detailFr =
      "Indiquez les frais (phase 1, sortie de cash) et la date du déboursé pour ancrer la ligne.";
    headlineEn = "Step: Phase 1 — disbursement";
    detailEn = "Enter the fee (phase 1 cash out) and disbursement date.";
  } else if (nextPhase != null && nextPhase >= 2 && nextPhase <= 7) {
    const idx = nextPhase - 2;
    headlineFr = `Étape actuelle : Phase ${nextPhase}`;
    detailFr = `Saisir le gain/perte pour : ${LEDGER_PHASE_LABELS_FR[idx]}. Colonnes suivantes restent vides jusqu’à la clôture de chaque journée.`;
    headlineEn = `Current step: Phase ${nextPhase}`;
    detailEn = `Enter P&L for ${LEDGER_PHASE_LABELS_EN[idx]}. Later columns stay empty until each day is closed.`;
  } else {
    headlineFr = "Feuille — phases 1 à 7 saisies";
    detailFr =
      "Toutes les colonnes sont remplies. Le total reflète la somme des phases (comme sur votre tableau).";
    headlineEn = "Ledger — all phases entered";
    detailEn =
      "All seven phases are filled; total matches your sheet-style sum.";
    if (ledgerTotal < 0) {
      detailFr += " Total final négatif sur cette ligne.";
      detailEn += " Final row total is negative.";
    }
  }

  if (sheetNegativeOngoing) {
    detailFr +=
      " Total provisoire négatif : sur votre échantillon, les lignes « en cours » ont souvent un total encore négatif.";
    detailEn +=
      " Negative running total — on your sample, ongoing rows often stay negative until later phases.";
  }

  return {
    phase1Started: p1,
    nextPhaseNumber: nextPhase,
    lastRecordedPhaseNumber: lastRecorded,
    ledgerTotal,
    sheetNegativeOngoing,
    headlineFr,
    detailFr,
    headlineEn,
    detailEn,
    rows,
  };
}

/**
 * Only phases you've **entered** (outcomes): phase 1 if the sheet started,
 * phases 2–7 only when `value` is set. No empty future rows.
 */
export function getVisibleLedgerRows(
  ledger: ChallengeLedgerProgress
): LedgerRowView[] {
  return ledger.rows.filter((r) => {
    if (r.phase === 1) return ledger.phase1Started;
    return r.value != null;
  });
}

/** Short outcome label for a completed ledger cell. */
export function ledgerOutcomeLabel(value: number | null): string {
  if (value == null) return "—";
  if (value > 0) return "Up";
  if (value < 0) return "Down";
  return "Flat";
}

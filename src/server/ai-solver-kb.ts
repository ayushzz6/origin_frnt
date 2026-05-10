import fs from "node:fs";
import path from "node:path";

type Subject = "bio" | "chem" | "math" | "phy";

const SUBJECTS: readonly Subject[] = ["bio", "chem", "math", "phy"] as const;

const SUBJECT_LABELS: Record<Subject, string> = {
  bio: "Biology",
  chem: "Chemistry",
  math: "Mathematics",
  phy: "Physics",
};

const SUBJECT_ALIASES: Record<string, Subject> = {
  bio: "bio",
  biology: "bio",
  chem: "chem",
  chemistry: "chem",
  math: "math",
  maths: "math",
  mathematics: "math",
  phy: "phy",
  physics: "phy",
};

const TOKEN_EQUIVALENTS: Record<string, string> = {
  thermodynamics: "thermodynamic",
  electrostatics: "electrostatic",
  kinematics: "kinematic",
  mechanics: "mechanic",
  optics: "optic",
};

const SUBJECT_ANCHOR_TOKENS: Record<Subject, Set<string>> = {
  bio: new Set([
    "mitosis", "meiosis", "phloem", "xylem", "atp", "enzyme", "ribosome",
    "chloroplast", "mitochondria", "photosynthesis", "dna", "rna",
    "gene", "chromosome", "organism", "species", "tissue", "neuron",
    "hormone", "antibody",
  ]),
  chem: new Set([
    "oxidation", "reduction", "mole", "ester", "alkane", "alkene",
    "alcohol", "aldehyde", "ketone", "sn1", "sn2", "pka", "acid",
    "base", "buffer", "orbital", "hybridization", "resonance",
    "catalyst", "equilibrium",
  ]),
  math: new Set([
    "integral", "integration", "derivative", "differentiation", "matrix",
    "determinant", "vector", "eigen", "limit", "continuity", "probability",
    "permutation", "combination", "trigonometry", "logarithm", "polynomial",
    "calculus", "parabola", "ellipse", "hyperbola",
  ]),
  phy: new Set([
    "newton", "torque", "flux", "capacitor", "inductor", "resistor",
    "velocity", "acceleration", "momentum", "kinematics", "gravitation",
    "friction", "pendulum", "oscillation", "wave", "refraction",
    "diffraction", "interference", "voltage", "current",
  ]),
};

const CROSS_SUBJECT_SCORE_FLOOR = 6;
const CROSS_SUBJECT_MARGIN = 3;
const ANCHOR_BONUS = 2;
// Score boost for matches in the active subject when ranking clarifier
// suggestions. Keeps a Physics thread from surfacing Biology suggestions
// when the question has weak partial matches in both subjects.
const IN_SUBJECT_BIAS = 4;
// Minimum confidence the cross-subject redirect needs to OVERRIDE the
// student's chosen subject. Without this, any cross-hit (even a weak one)
// would yank the answer into another subject.
const CROSS_SUBJECT_OVERRIDE_FLOOR = 8;

const ATOM_TYPE_ORDER: Record<string, string[]> = {
  quick: ["INTUITION", "FORMULA", "MISTAKE_WARN"],
  medium: ["INTUITION", "FORMULA", "EXAMPLE", "MISTAKE_WARN"],
  deep: [
    "INTUITION",
    "FORMULA",
    "DERIVATION_STEP",
    "ANALOGY",
    "EXAMPLE",
    "MISTAKE_WARN",
    "SOCRATIC_PROBE",
  ],
};

const STEP_TITLES: Record<string, string> = {
  INTUITION: "Core Intuition",
  FORMULA: "Key Formula",
  DERIVATION_STEP: "Why This Works",
  ANALOGY: "Think of It Like This",
  EXAMPLE: "Worked Example",
  MISTAKE_WARN: "Trap to Avoid",
  SOCRATIC_PROBE: "Challenge Check",
};

const STOPWORDS = new Set([
  "what", "when", "where", "which", "with", "from", "that", "this",
  "into", "your", "about", "please", "explain", "concept", "problem",
  "question", "chapter", "formula", "equation", "principle", "solve",
  "help", "want", "understand", "learn", "physics", "chemistry", "biology", "math", "maths",
  "mathematics",
]);

const REFLEX_PATTERNS: Array<[RegExp, string]> = [
  [/\b(yes|yeah|yep|ok|okay|sure|got it|understood)\b/, "Good. Push one layer deeper now and ask me where the confusion still remains."],
  [/\b(thanks|thank you)\b/, "Keep going. Ask for an example, derivation, or common trap and I will sharpen the same concept further."],
  [/\b(wait|slow down|hold on)\b/, "Let's slow it down. Tell me the exact line that feels confusing and I will unwrap only that part."],
];

const INTENT_RULES: Array<[string, RegExp[], string[]]> = [
  ["challenge", [/\b(challenge me|quiz me|test me|probe me)\b/], ["SOCRATIC_PROBE"]],
  ["derivation", [/\b(derive|derivation|prove|how do we get|where does .* come from)\b/], ["DERIVATION_STEP", "FORMULA"]],
  ["example", [/\b(example|numerical|solve|worked out|practice problem)\b/], ["EXAMPLE", "FORMULA"]],
  ["analogy", [/\b(analogy|intuitive|real life|simple words|everyday)\b/], ["ANALOGY", "INTUITION"]],
  ["mistakes", [/\b(mistake|trap|avoid|common error|where do students go wrong)\b/], ["MISTAKE_WARN"]],
  ["formula", [/\b(formula|equation|expression|mathematical)\b/], ["FORMULA", "INTUITION"]],
  ["why", [/\b(why|depend on|proportional|squared|change if)\b/], ["DERIVATION_STEP", "ANALOGY", "INTUITION"]],
];

interface TeachingAtom {
  atom_id: string;
  concept: string;
  atom_type: string;
  content: string;
  source?: string;
  use_count?: number;
  created_at?: number;
}

interface ConceptAssets {
  knowledgeBase: Record<string, TeachingAtom[]>;
  conceptGraph: {
    concepts?: string[];
    prerequisites?: Record<string, string[]>;
  };
  concepts: string[];
  conceptTokens: Record<string, Set<string>>;
  normalizedConcepts: Record<string, string>;
}

export interface KnowledgeSolverTurn {
  content: string;
  metadata: Record<string, unknown>;
  activeConcept: string | null;
  suggestedTitle: string | null;
}

export interface KnowledgeSolverInput {
  sessionTitle: string;
  sessionSubject: string;
  activeConcept: string | null;
  studentInput: string;
  image?: string | null;
}

const assetCache = new Map<Subject, ConceptAssets>();

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => TOKEN_EQUIVALENTS[token] ?? token)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function clampText(value: string, limit = 3200): string {
  const stripped = value.replace(/\s+/g, " ").trim();
  return stripped.length <= limit ? stripped : `${stripped.slice(0, limit - 3).trimEnd()}...`;
}

export class KbAssetMissingError extends Error {
  constructor(public readonly subject: Subject, public readonly missingFile: string, cause?: unknown) {
    super(`Knowledge base asset missing for subject=${subject}: ${missingFile}`);
    this.name = "KbAssetMissingError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

function subjectDataDir(subject: Subject): string {
  return path.join(process.cwd(), "data", "subjects", subject);
}

function readJsonAsset(subject: Subject, filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    throw new KbAssetMissingError(subject, filePath, err);
  }
}

function loadAssets(subject: Subject): ConceptAssets {
  const cached = assetCache.get(subject);
  if (cached) {
    return cached;
  }

  const dataDir = subjectDataDir(subject);
  const knowledgeBase = readJsonAsset(subject, path.join(dataDir, "knowledge_base.json")) as Record<string, TeachingAtom[]>;
  const conceptGraph = readJsonAsset(subject, path.join(dataDir, "concept_graph.json")) as ConceptAssets["conceptGraph"];

  const concepts = Object.keys(knowledgeBase);
  const conceptTokens = Object.fromEntries(
    concepts.map((concept) => [concept, new Set(tokenize(concept))]),
  );
  const normalizedConcepts = Object.fromEntries(
    concepts.map((concept) => [concept, normalizeText(concept)]),
  );

  const assets: ConceptAssets = {
    knowledgeBase,
    conceptGraph,
    concepts,
    conceptTokens,
    normalizedConcepts,
  };
  assetCache.set(subject, assets);
  return assets;
}

function resolveSubject(sessionSubject: string | undefined | null): Subject | null {
  const key = (sessionSubject ?? "").trim().toLowerCase();
  if (!key) {
    return null;
  }
  return SUBJECT_ALIASES[key] ?? null;
}

function candidateConcepts(subject: Subject, text: string): Array<{ concept: string; score: number }> {
  const assets = loadAssets(subject);
  const normalizedQuery = normalizeText(text);
  const queryTokens = tokenize(text);
  const queryTokenSet = new Set(queryTokens);
  const candidates: Array<{ concept: string; score: number }> = [];

  for (const concept of assets.concepts) {
    const conceptTokens = assets.conceptTokens[concept];
    const conceptNorm = assets.normalizedConcepts[concept];
    const overlap = [...queryTokenSet].filter((token) => conceptTokens.has(token));
    let score = 0;

    if (conceptNorm && normalizedQuery.includes(conceptNorm)) {
      score += 10;
    }

    for (const token of overlap) {
      score += 2;
      if (token.length >= 8) {
        score += 1.5;
      }
    }

    if (overlap.length >= 2) {
      score += 1;
    }

    if (queryTokens.length === 1 && conceptNorm.startsWith(queryTokens[0])) {
      score += 1.25;
    }

    const extraTokens = Math.max(conceptTokens.size - overlap.length, 0);
    if (extraTokens > 0) {
      score -= Math.min(1.25, extraTokens * 0.08);
    }

    if (score > 0) {
      candidates.push({ concept, score });
    }
  }

  return candidates.sort((left, right) =>
    right.score - left.score
      || assets.conceptTokens[left.concept].size - assets.conceptTokens[right.concept].size
      || left.concept.length - right.concept.length,
  );
}

function shouldAcceptShorthandConceptMatch(
  candidates: Array<{ concept: string; score: number }>,
  text: string,
  fallbackConcept: string | null,
): boolean {
  if (fallbackConcept) {
    return false;
  }

  const best = candidates[0];
  if (!best || best.score < 2) {
    return false;
  }

  const queryTokens = tokenize(text);
  if (queryTokens.length === 0 || queryTokens.length > 5) {
    return false;
  }

  if (candidates.length === 1) {
    return true;
  }

  return best.score - candidates[1].score >= 2;
}

function detectConcept(subject: Subject, text: string, fallbackConcept: string | null): string | null {
  const candidates = candidateConcepts(subject, text);
  const best = candidates[0];
  if (!best) {
    return fallbackConcept;
  }

  if (best.score >= 4) {
    return best.concept;
  }

  const queryTokens = tokenize(text);
  if (best.score >= 3 && queryTokens.length > 0 && queryTokens.length <= 2) {
    return best.concept;
  }

  if (best.score >= 1.5 && queryTokens.length === 1) {
    if (candidates.length === 1 || best.score - candidates[1].score >= 0.2) {
      return best.concept;
    }
  }

  if (shouldAcceptShorthandConceptMatch(candidates, text, fallbackConcept)) {
    return best.concept;
  }

  return fallbackConcept;
}

function anchorBonus(subject: Subject, tokens: Set<string>): number {
  const anchors = SUBJECT_ANCHOR_TOKENS[subject];
  for (const token of tokens) {
    if (anchors.has(token)) {
      return ANCHOR_BONUS;
    }
  }
  return 0;
}

function crossSubjectLookupScored(
  text: string,
): { subject: Subject; concept: string; score: number } | null {
  const tokens = new Set(tokenize(text));
  const perSubject: Array<{ subject: Subject; concept: string; score: number }> = [];

  for (const subject of SUBJECTS) {
    const candidates = candidateConcepts(subject, text);
    const top = candidates[0];
    if (!top) continue;
    perSubject.push({
      subject,
      concept: top.concept,
      score: top.score + anchorBonus(subject, tokens),
    });
  }

  if (perSubject.length === 0) return null;
  perSubject.sort((a, b) => b.score - a.score);
  const winner = perSubject[0];
  if (winner.score < CROSS_SUBJECT_SCORE_FLOOR) return null;
  for (let i = 1; i < perSubject.length; i++) {
    if (winner.score - perSubject[i].score < CROSS_SUBJECT_MARGIN) return null;
  }
  return winner;
}

function crossSubjectLookup(text: string): { subject: Subject; concept: string } | null {
  const tokens = new Set(tokenize(text));
  const perSubject: Array<{ subject: Subject; concept: string; score: number }> = [];

  for (const subject of SUBJECTS) {
    const candidates = candidateConcepts(subject, text);
    const top = candidates[0];
    if (!top) {
      continue;
    }
    perSubject.push({
      subject,
      concept: top.concept,
      score: top.score + anchorBonus(subject, tokens),
    });
  }

  if (perSubject.length === 0) {
    return null;
  }

  perSubject.sort((a, b) => b.score - a.score);
  const winner = perSubject[0];
  if (winner.score < CROSS_SUBJECT_SCORE_FLOOR) {
    return null;
  }

  for (let i = 1; i < perSubject.length; i++) {
    if (winner.score - perSubject[i].score < CROSS_SUBJECT_MARGIN) {
      return null;
    }
  }

  return { subject: winner.subject, concept: winner.concept };
}

function atomsForConcept(subject: Subject, concept: string): TeachingAtom[] {
  return loadAssets(subject).knowledgeBase[concept] ?? [];
}

function pickAtoms(subject: Subject, concept: string, atomTypes: string[]): TeachingAtom[] {
  const atoms = atomsForConcept(subject, concept);
  return atomTypes
    .map((atomType) => atoms.find((atom) => atom.atom_type === atomType))
    .filter((atom): atom is TeachingAtom => Boolean(atom));
}

function buildStep(atom: TeachingAtom): string {
  return `**${STEP_TITLES[atom.atom_type] ?? atom.atom_type}:** ${clampText(atom.content)}`;
}

function checkReadiness(subject: Subject, concept: string): { ready: boolean; missing: string[] } {
  const prereqs = loadAssets(subject).conceptGraph.prerequisites?.[concept] ?? [];
  return {
    ready: prereqs.length === 0,
    missing: prereqs.slice(0, 3),
  };
}

function matchIntent(studentInput: string): { intent: string; atomTypes: string[]; reflex?: string } {
  const normalized = normalizeText(studentInput);

  for (const [pattern, response] of REFLEX_PATTERNS) {
    if (pattern.test(normalized)) {
      return { intent: "reflex", atomTypes: [], reflex: response };
    }
  }

  for (const [intent, patterns, atomTypes] of INTENT_RULES) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return { intent, atomTypes };
    }
  }

  return { intent: "clarify", atomTypes: ["INTUITION", "FORMULA"] };
}

function buildConceptClarifier(
  studentInput: string,
  activeSubject: Subject | null = null,
): KnowledgeSolverTurn {
  const tokens = new Set(tokenize(studentInput));
  const pool: Array<{ subject: Subject; concept: string; score: number }> = [];
  for (const subject of SUBJECTS) {
    // Big bias toward the thread's subject so a Physics thread doesn't surface
    // Biology suggestions when both have weak partial matches.
    const subjectBias = activeSubject && subject === activeSubject ? IN_SUBJECT_BIAS : 0;
    for (const candidate of candidateConcepts(subject, studentInput).slice(0, 3)) {
      pool.push({
        subject,
        concept: candidate.concept,
        score: candidate.score + anchorBonus(subject, tokens) + subjectBias,
      });
    }
  }
  pool.sort((a, b) => b.score - a.score);

  const suggestions = pool
    .slice(0, 3)
    .map((entry) => `**${entry.concept}** (${SUBJECT_LABELS[entry.subject]})`)
    .join(", ");

  const content = suggestions
    ? [
        "I need the exact subject + concept before I can explain this properly.",
        `Closest concept matches are: ${suggestions}.`,
        "Reply with the subject and concept name, or paste the most important line from the problem statement.",
      ].join("\n\n<!-- step -->\n\n")
    : [
        "I could not lock onto the concept from that message alone.",
        "Tell me the subject, chapter, the core formula, or the exact phenomenon involved.",
        "For example: *Chemistry / SN1 Reaction*, *Biology / Meiosis*, or *Physics / Work-Energy Theorem*.",
      ].join("\n\n<!-- step -->\n\n");

  // Top-pool score the caller can use to decide whether the KB is confident
  // enough to answer, or whether to fall through to the LLM/mentor brain.
  const topScore = pool[0]?.score ?? 0;

  return {
    content,
    activeConcept: null,
    suggestedTitle: null,
    metadata: {
      persona: "Explainer",
      source: "subject_kb_concept_clarifier",
      stage: "awaiting_concept",
      llmCalled: false,
      kbResolved: false,
      topMatchScore: topScore,
    },
  };
}

export function solveWithKnowledgeBase(input: KnowledgeSolverInput): KnowledgeSolverTurn {
  const studentInput = (input.studentInput || "").trim();

  if (input.image && !studentInput) {
    return {
      content: [
        "I received the image, but this version still needs the problem text or the concept name to reason reliably.",
        "**What to send next:** type the question statement, the chapter name, or the exact formula you are stuck on.",
        "**Fastest path:** mention the concept or paste the most important line and I will take over from there.",
      ].join("\n\n<!-- step -->\n\n"),
      activeConcept: input.activeConcept,
      suggestedTitle: null,
      metadata: {
        persona: "Explainer",
        source: "subject_kb_image_clarifier",
        stage: "awaiting_problem_text",
        llmCalled: false,
        kbResolved: false,
      },
    };
  }

  const combined = [studentInput, input.sessionTitle].filter(Boolean).join(" ");
  const directSubject = resolveSubject(input.sessionSubject);
  let subject: Subject | null = directSubject;
  let subjectResolution: "direct" | "cross_subject" | "cross_subject_redirect" = "direct";
  let detectedConcept: string | null = null;
  let advisory: string | null = null;

  if (subject) {
    detectedConcept = detectConcept(subject, combined, input.activeConcept);
    // Only redirect to another subject when (a) we couldn't find anything in
    // the student's chosen subject, OR (b) the cross-subject hit clears a high
    // confidence floor. Without this, a Physics thread asking a generic word
    // like "thermodynamics" got dragged into Biology because Bio happened to
    // have several literal "Thermodynamics of …" concepts.
    if (!detectedConcept) {
      const crossHit = crossSubjectLookupScored(combined);
      if (crossHit && crossHit.subject !== subject && crossHit.score >= CROSS_SUBJECT_OVERRIDE_FLOOR) {
        advisory =
          `**Heads up:** you're in the ${SUBJECT_LABELS[subject]} section, ` +
          `but that question sits in ${SUBJECT_LABELS[crossHit.subject]}. ` +
          `I'll answer it now — consider picking ${SUBJECT_LABELS[crossHit.subject]} next time to stay focused.`;
        subject = crossHit.subject;
        detectedConcept = crossHit.concept;
        subjectResolution = "cross_subject_redirect";
      }
    }
  } else {
    const crossHit = crossSubjectLookup(combined);
    if (crossHit) {
      subject = crossHit.subject;
      detectedConcept = crossHit.concept;
      subjectResolution = "cross_subject";
    }
  }

  if (!subject || !detectedConcept) {
    return buildConceptClarifier(studentInput, directSubject);
  }

  const subjectLabel = SUBJECT_LABELS[subject];
  const activeConcept = input.activeConcept;
  const explainConcept = !activeConcept || activeConcept !== detectedConcept;
  const readiness = checkReadiness(subject, detectedConcept);

  if (explainConcept) {
    const atoms = pickAtoms(subject, detectedConcept, ATOM_TYPE_ORDER.medium);
    const parts: string[] = [];
    if (advisory) parts.push(advisory);
    parts.push(`Let's solve **${detectedConcept}** from the ${subjectLabel} knowledge base.`);
    if (!readiness.ready && readiness.missing.length > 0) {
      parts.push(
        `**Foundation Check:** Before this topic becomes easy, keep **${readiness.missing.join(", ")}** warm in your head.`,
      );
    }
    parts.push(...atoms.map(buildStep));

    return {
      content: parts.join("\n\n<!-- step -->\n\n"),
      activeConcept: detectedConcept,
      suggestedTitle: `${subjectLabel} - ${detectedConcept}`,
      metadata: {
        persona: "Explainer",
        source: "subject_kb_atom_compilation",
        stage: "concept_explanation",
        concept: detectedConcept,
        subject,
        subjectResolution,
        crossSubjectAdvisory: Boolean(advisory),
        llmCalled: false,
        readiness,
      },
    };
  }

  const intent = matchIntent(studentInput);
  if (intent.intent === "reflex" && intent.reflex) {
    const reflexContent = advisory ? `${advisory}\n\n<!-- step -->\n\n${intent.reflex}` : intent.reflex;
    return {
      content: reflexContent,
      activeConcept: detectedConcept,
      suggestedTitle: `${subjectLabel} - ${detectedConcept}`,
      metadata: {
        persona: "Explainer",
        source: "subject_kb_reflex",
        stage: "followup",
        concept: detectedConcept,
        subject,
        subjectResolution,
        crossSubjectAdvisory: Boolean(advisory),
        intent: "reflex",
        llmCalled: false,
      },
    };
  }

  const atomTypes = intent.atomTypes.length > 0 ? intent.atomTypes : ATOM_TYPE_ORDER.medium;
  const atoms = pickAtoms(subject, detectedConcept, atomTypes).slice(0, 3);
  const parts: string[] = [];
  if (advisory) parts.push(advisory);
  parts.push(`Let's stay on **${detectedConcept}** and attack exactly what you asked.`);
  parts.push(...atoms.map(buildStep));
  if (intent.intent === "challenge" && !atoms.some((atom) => atom.atom_type === "SOCRATIC_PROBE")) {
    parts.push(
      "**Challenge Check:** Before you look back at the formula, tell me what quantity controls this result most strongly.",
    );
  }

  return {
    content: parts.join("\n\n<!-- step -->\n\n"),
    activeConcept: detectedConcept,
    suggestedTitle: `${subjectLabel} - ${detectedConcept}`,
    metadata: {
      persona: "Explainer",
      source: "subject_kb_atom_assembly",
      stage: "followup",
      concept: detectedConcept,
      subject,
      subjectResolution,
      crossSubjectAdvisory: Boolean(advisory),
      intent: intent.intent,
      llmCalled: false,
      readiness,
    },
  };
}

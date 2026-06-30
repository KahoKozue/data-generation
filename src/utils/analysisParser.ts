export type RiskLevel = "high" | "medium" | "low" | "unknown";
// 五分法（meeting24 量表顆粒度：三分法 → 五分法）
export type RiskLevel5 = "極高" | "中高" | "中" | "中低" | "極低" | "unknown";
export type Verdict = "malicious" | "benign" | "uncertain";
export type DimensionLabel = "語意目的" | "語用操縱策略" | "情境一致性" | "決策點" | string;

export interface DecisionPoint {
  label: string;
  evidence?: string;
  dimension?: DimensionLabel;
  why?: string;
  severity?: RiskLevel;
}

export interface EvidenceItem {
  quote: string;
  dimension?: DimensionLabel;
  note?: string;
}

export interface RiskProfile {
  persona?: string;
  why?: string;
  vulnerabilities?: string[];
}

export interface AnalysisStructured {
  verdict: Verdict;
  riskLevel?: RiskLevel5;
  primaryRisk?: string;
  summary?: string;
  decisionPoints?: DecisionPoint[];
  evidence?: EvidenceItem[];
  riskProfile?: RiskProfile;
  mitigations?: string[];
  missingInfo?: string[];
  raw?: unknown;
}

const coerceVerdict = (value: string | undefined): Verdict => {
  if (!value) return "uncertain";
  const normalized = value.toLowerCase();
  if (normalized.includes("mal")) return "malicious";
  if (normalized.includes("benign") || normalized.includes("good")) return "benign";
  return "uncertain";
};

const coerceRiskLevel = (value: string | undefined): RiskLevel => {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (normalized.startsWith("h")) return "high";
  if (normalized.startsWith("m")) return "medium";
  if (normalized.startsWith("l")) return "low";
  return "unknown";
};

// 五分法：極高/中高/中/中低/極低（先比較長詞，避免「中高」被「中」截走）
const coerceRiskLevel5 = (value: string | undefined): RiskLevel5 => {
  if (!value) return "unknown";
  const v = value.trim();
  if (v.includes("極高")) return "極高";
  if (v.includes("中高")) return "中高";
  if (v.includes("中低")) return "中低";
  if (v.includes("極低")) return "極低";
  if (v.includes("中")) return "中";
  const lower = v.toLowerCase();
  if (/(very high|critical)/.test(lower)) return "極高";
  if (lower.startsWith("h") || lower.includes("high")) return "中高";
  if (/(very low|minimal)/.test(lower)) return "極低";
  if (lower.startsWith("l") || lower.includes("low")) return "中低";
  if (lower.startsWith("m") || lower.includes("medium")) return "中";
  return "unknown";
};

const normalizeArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const dimensionToLabel = (value: string | undefined): DimensionLabel | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (lower === "a") return "語意目的";
  if (lower === "b") return "語用操縱策略";
  if (lower === "c") return "情境一致性";
  if (lower === "d") return "決策點";
  return normalized;
};

const extractJsonText = (text: string): string | null => {
  if (!text) return null;
  let cleaned = text.trim();

  // Strip Markdown fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "");
    const closingIndex = cleaned.lastIndexOf("```");
    if (closingIndex !== -1) {
      cleaned = cleaned.slice(0, closingIndex);
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;

  return cleaned.slice(firstBrace, lastBrace + 1);
};

export const parseAnalysis = (text: string): AnalysisStructured | null => {
  const jsonText = extractJsonText(text);
  if (!jsonText) return null;

  try {
    const data = JSON.parse(jsonText);
    const verdict = coerceVerdict(
      data.verdict || data.label || data.classification || data.result
    );
    const riskLevel = coerceRiskLevel5(data.risk_level || data.riskLevel || data.severity);
    const decisionPoints: DecisionPoint[] = normalizeArray(data.decision_points || data.decisions).map((d: any) => ({
      label: d.label || d.name || "",
      evidence: d.evidence || d.quote,
      dimension: dimensionToLabel(d.dimension),
      why: d.why || d.reason,
      severity: coerceRiskLevel(d.severity),
    }));

    const evidence: EvidenceItem[] = normalizeArray(data.evidence).map((e: any) => ({
      quote: e.quote || e.text || "",
      dimension: dimensionToLabel(e.dimension),
      note: e.note || e.reason,
    }));

    const riskProfile: RiskProfile = data.incident_analysis || data.risk_profile || data.profile || {
      persona: data.persona,
      why: data.why,
      vulnerabilities: data.vulnerabilities,
    };

    const mitigations = normalizeArray(data.mitigations || data.recommendations);
    const missingInfo = normalizeArray(data.missing_info || data.gaps || data.questions);

    return {
      verdict,
      riskLevel,
      primaryRisk: data.primary_risk || data.risk || data.risk_type,
      summary: data.incident_summary || data.summary || data.overview,
      decisionPoints,
      evidence,
      riskProfile,
      mitigations,
      missingInfo,
      raw: data,
    };
  } catch (e) {
    console.warn("Failed to parse analysis JSON", e);
    return null;
  }
};

import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
 
type CompactAdvisorPayload = {
  userQuestion?: string;
  financialSummary?: {
    netWorthUsd?: number;
    savingsRate?: number;
    allocations?: Array<{ assetType: string; percentage: number }>;
    alerts?: Array<{ severity: 'low' | 'medium' | 'high'; message: string }>;
    recommendations?: Array<{ action: string }>;
    simulation?: {
      yearsToGoal?: number | null;
      expectedReturn?: number;
    };
    snapshotHash?: string;
  };
  memory?: {
    lastQuestions?: string[];
    lastRecommendations?: Array<{
      text: string;
      impact: number;
      status: 'pending' | 'completed' | 'ignored';
    }>;
  };
};
 
type AdvisorStructuredResponse = {
  answer: string;
  actions: Array<{ text: string; impact: number }>;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
};
 
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const short = (text: string, max = 180) =>
  text.length <= max ? text : `${text.slice(0, max)}...`;
 
function scoreActionImpact(params: {
  text: string;
  savingsRate: number;
  topAllocationPct: number;
  yearsToGoal: number | null;
}) {
  const { text, savingsRate, topAllocationPct, yearsToGoal } = params;
  const lower = text.toLowerCase();
  let impact = 0.4;
 
  if (savingsRate < 0) impact = Math.max(impact, 1);
  if (lower.includes('savings') || lower.includes('expenses') || lower.includes('spend'))
    impact = Math.max(impact, savingsRate < 0.1 ? 0.9 : 0.7);
  if (lower.includes('rebalance') || lower.includes('concentration') || lower.includes('divers'))
    impact = Math.max(impact, topAllocationPct > 70 ? 0.85 : 0.72);
  if (lower.includes('goal') || lower.includes('timeline'))
    impact = Math.max(impact, yearsToGoal === null ? 0.8 : yearsToGoal > 8 ? 0.75 : 0.55);
 
  return clamp(impact, 0, 1);
}
 
/**
 * ── FIX: Confidence now reflects DATA RELIABILITY, not financial health.
 *
 * Old logic penalised users who had positive savings but also a severe alert,
 * scoring "consistency" = 0.35. That conflated a mixed (but valid) financial
 * state with unreliable data — wrong concept entirely.
 *
 * New approach:
 *   - dataCompleteness  → how much input data we actually have (50% weight)
 *   - dataConsistency   → whether the data fields agree with each other (30%)
 *     • Penalises truly contradictory signals: e.g. savingsRate reported as
 *       positive but totalExpenses > totalIncome (data entry error likely).
 *     • Does NOT penalise "savings positive AND there's an alert" — that is
 *       a perfectly valid real-world state.
 *   - simulationReliability → how trustworthy the projection inputs are (20%)
 */
function computeConfidence(payload: CompactAdvisorPayload): number {
  const summary = payload.financialSummary;
 
  // ── Data completeness ─────────────────────────────────────────────────
  const signals = [
    Number.isFinite(summary?.netWorthUsd),
    Number.isFinite(summary?.savingsRate),
    (summary?.allocations?.length ?? 0) > 0,
    (summary?.alerts?.length ?? 0) > 0,
    (summary?.recommendations?.length ?? 0) > 0,
    Number.isFinite(summary?.simulation?.expectedReturn ?? null) ||
      summary?.simulation?.yearsToGoal !== undefined,
  ];
  const dataCompleteness = signals.filter(Boolean).length / signals.length;
 
  // ── Data consistency ──────────────────────────────────────────────────
  // Only penalise when fields genuinely contradict each other, which hints
  // at stale/missing data rather than a mixed-but-valid financial situation.
  const savingsRate = summary?.savingsRate ?? 0;
  const hasInconsistentData =
    // Reported positive savings rate but alerts say expenses > income
    (savingsRate > 0 &&
      (summary?.alerts ?? []).some(
        (a) =>
          a.severity === 'high' &&
          a.message.toLowerCase().includes('expenses') &&
          a.message.toLowerCase().includes('income'),
      )) ||
    // Net worth is positive but no allocations (data not loaded yet)
    ((summary?.netWorthUsd ?? 0) > 0 && (summary?.allocations?.length ?? 0) === 0);
 
  const dataConsistency = hasInconsistentData ? 0.45 : 0.9;
 
  // ── Simulation reliability ────────────────────────────────────────────
  const yearsToGoal = summary?.simulation?.yearsToGoal;
  const expectedReturn = summary?.simulation?.expectedReturn ?? 0;
  const simulationReliability =
    yearsToGoal === null ? 0.55 : expectedReturn > 0 ? 0.9 : 0.65;
 
  const confidence =
    0.5 * dataCompleteness + 0.3 * dataConsistency + 0.2 * simulationReliability;
 
  return clamp(confidence, 0, 1);
}
 
function buildRuleBased(
  question: string,
  payload: CompactAdvisorPayload,
): AdvisorStructuredResponse {
  const summary = payload.financialSummary;
  const q = question.toLowerCase();
 
  const savingsRate = summary?.savingsRate ?? 0;
  const netWorthUsd = summary?.netWorthUsd ?? 0;
  const yearsToGoal = summary?.simulation?.yearsToGoal ?? null;
 
  const topAllocation = (summary?.allocations ?? [])[0];
  const topAlert = (summary?.alerts ?? [])[0];
  const topRec = (summary?.recommendations ?? [])[0];
  const memory = payload.memory;
  const pendingMemoryRec = (memory?.lastRecommendations ?? []).find(
    (r) => r.status === 'pending',
  );
 
  const allocationImbalance = (topAllocation?.percentage ?? 0) > 50;
  const estimatedGoalNote =
    yearsToGoal === null
      ? 'Your current path does not reach the goal in the simulated horizon.'
      : `Estimated timeline to goal is about ${yearsToGoal} years.`;
 
  const weaknesses: string[] = [];
  if (savingsRate < 0.1)
    weaknesses.push(
      `Savings rate is ${Math.round(savingsRate * 1000) / 10}%, below a healthy 15% target.`,
    );
  if (allocationImbalance)
    weaknesses.push(
      `Portfolio is concentrated in ${topAllocation?.assetType} (${Math.round((topAllocation?.percentage ?? 0) * 10) / 10}%).`,
    );
  if (topAlert)
    weaknesses.push(
      topAlert.message.length > 120
        ? `${topAlert.message.slice(0, 120)}...`
        : topAlert.message,
    );
 
  const primaryWeakness =
    weaknesses[0] ?? 'No severe weaknesses detected, but optimisation opportunities remain.';
  const memoryPrefix = memory?.lastQuestions?.length
    ? `Last time you asked about "${memory.lastQuestions[0]}". `
    : '';
 
  const actionCandidates = [
    topRec?.action ?? 'Increase monthly savings contributions by at least 10%.',
    allocationImbalance
      ? `Rebalance 10–20% away from ${topAllocation?.assetType ?? 'the largest position'} to reduce concentration risk.`
      : 'Review allocation quarterly to keep diversification balanced.',
    yearsToGoal === null
      ? 'Raise savings and/or reduce expenses to make the goal reachable in simulation.'
      : 'Maintain contributions and monitor progress monthly against timeline.',
  ];
 
  const actions = actionCandidates
    .map((text) => ({
      text,
      impact: scoreActionImpact({
        text,
        savingsRate,
        topAllocationPct: topAllocation?.percentage ?? 0,
        yearsToGoal,
      }),
    }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
 
  let priority: 'high' | 'medium' | 'low' = 'medium';
  if (savingsRate < 0 || topAlert?.severity === 'high') priority = 'high';
  if (savingsRate > 0.2 && !allocationImbalance) priority = 'low';
 
  if (q.includes('goal') || q.includes('reach') || q.includes('when')) {
    return {
      answer: short(
        `${estimatedGoalNote} ${primaryWeakness} Focus first on the top action below to accelerate progress.`,
      ),
      actions,
      priority,
      confidence: computeConfidence(payload),
    };
  }
 
  return {
    answer: short(
      `${memoryPrefix}${primaryWeakness} Net worth is ${netWorthUsd.toFixed(2)} USD. ${pendingMemoryRec ? `You still have a pending step: ${pendingMemoryRec.text}.` : 'Prioritise concrete improvements over generic changes.'}`,
    ),
    actions,
    priority,
    confidence: computeConfidence(payload),
  };
}
 
async function enhanceWithLLM(
  ruleBased: AdvisorStructuredResponse,
  payload: CompactAdvisorPayload,
): Promise<AdvisorStructuredResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ruleBased;
 
  const systemPrompt = [
    'You are a professional financial advisor.',
    'Use the provided data only. Do not hallucinate.',
    'Must give actionable financial advice and no generic text.',
    "Prioritize the user's biggest financial weakness.",
    'Return strict JSON with: answer(max 120 words), actions([{text,impact(0-1)}], max 3), priority(high|medium|low), confidence(0-1).',
    'Actions must include estimated impact and prioritize highest-impact improvements first.',
    'Reference memory when relevant and avoid repeating identical advice unless unresolved.',
  ].join(' ');
 
  const input = {
    userQuestion: payload.userQuestion,
    financialSummary: payload.financialSummary,
    ruleBasedDraft: ruleBased,
  };
 
  // ── FIX: Add explicit timeout so a slow OpenAI response does not consume
  // the entire Vercel function timeout (25 s) leaving nothing for the fallback.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
 
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(input) },
        ],
        text: { format: { type: 'json_object' } },
      }),
    });
 
    if (!response.ok) return ruleBased;
 
    const data = (await response.json().catch(() => null)) as any;
    const outputText = data?.output_text;
    if (!outputText) return ruleBased;
 
    const parsed = JSON.parse(outputText) as Partial<AdvisorStructuredResponse>;
 
    if (
      !parsed.answer ||
      !Array.isArray(parsed.actions) ||
      !parsed.priority ||
      typeof parsed.confidence !== 'number'
    ) {
      return ruleBased;
    }
 
    const actions = parsed.actions
      .map((a: any) => ({
        text: short(String(a?.text ?? ''), 180),
        impact: clamp(Number(a?.impact ?? 0), 0, 1),
      }))
      .filter((a) => a.text.length > 0)
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3);
 
    if (actions.length === 0) return ruleBased;
 
    return {
      answer: short(parsed.answer, 900),
      actions,
      priority: parsed.priority,
      // ── FIX: trust the LLM confidence only when it broadly agrees with
      // our rule-based confidence (within 0.3). If the LLM is wildly
      // different it probably hallucinated — use the average instead.
      confidence: Math.abs(parsed.confidence - ruleBased.confidence) <= 0.3
        ? clamp(parsed.confidence, 0, 1)
        : clamp((parsed.confidence + ruleBased.confidence) / 2, 0, 1),
    };
  } catch (error) {
    const isTimeout = (error as Error)?.name === 'AbortError';
    console.warn('[ai] llm_error', {
      isTimeout,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return ruleBased;
  } finally {
    clearTimeout(timeoutId);
  }
}
 
export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id)
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
 
  const body = await request.json().catch(() => ({} as CompactAdvisorPayload));
  const userQuestion = String(body.userQuestion ?? '').trim();
 
  if (!userQuestion)
    return NextResponse.json({ message: 'Question is required.' }, { status: 400 });
 
  // ── FIX: raised payload size limit to a realistic ceiling (8 KB).
  // The original 2 KB limit was too tight for real portfolios with 5-10
  // alerts and caused the advisor to throw instead of answering.
  const payloadSize = new TextEncoder().encode(JSON.stringify(body)).length;
  if (payloadSize > 8192) {
    console.warn('[ai] payload_too_large', { payloadSize });
    return NextResponse.json({ message: 'Payload too large.' }, { status: 413 });
  }
 
  console.log('[ai] question_received', {
    userId: session.user.id,
    question: userQuestion,
    payloadSize,
  });
 
  const ruleBased = buildRuleBased(userQuestion, body);
  console.log('[ai] rule_based_generated', {
    priority: ruleBased.priority,
    confidence: ruleBased.confidence,
  });
 
  try {
    const llmResponse = await enhanceWithLLM(ruleBased, { ...body, userQuestion });
    if (llmResponse !== ruleBased)
      console.log('[ai] llm_response', {
        priority: llmResponse.priority,
        confidence: llmResponse.confidence,
      });
    return NextResponse.json(llmResponse);
  } catch (error) {
    console.warn('[ai] fallback_used', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json(ruleBased);
  }
}
 

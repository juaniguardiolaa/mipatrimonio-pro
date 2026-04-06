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
    lastRecommendations?: Array<{ text: string; impact: number; status: 'pending' | 'completed' | 'ignored' }>;
  };
};

type AdvisorStructuredResponse = {
  answer: string;
  actions: Array<{ text: string; impact: number }>;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const short = (text: string, maxChars = 180) => (text.length <= maxChars ? text : `${text.slice(0, maxChars)}...`);

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
  if (lower.includes('savings') || lower.includes('expenses') || lower.includes('spend')) {
    impact = Math.max(impact, savingsRate < 0.1 ? 0.9 : 0.7);
  }
  if (lower.includes('rebalance') || lower.includes('concentration') || lower.includes('divers')) {
    impact = Math.max(impact, topAllocationPct > 70 ? 0.85 : 0.72);
  }
  if (lower.includes('goal') || lower.includes('timeline')) {
    impact = Math.max(impact, yearsToGoal === null ? 0.8 : yearsToGoal > 8 ? 0.75 : 0.55);
  }

  return clamp(impact, 0, 1);
}

function computeConfidence(payload: CompactAdvisorPayload) {
  const summary = payload.financialSummary;
  const hasNetWorth = Number.isFinite(summary?.netWorthUsd);
  const hasSavings = Number.isFinite(summary?.savingsRate);
  const hasAlloc = (summary?.allocations?.length ?? 0) > 0;
  const hasAlerts = (summary?.alerts?.length ?? 0) > 0;
  const hasRecs = (summary?.recommendations?.length ?? 0) > 0;
  const hasSimulation = Number.isFinite(summary?.simulation?.expectedReturn ?? null) || summary?.simulation?.yearsToGoal !== undefined;

  const completenessSignals = [hasNetWorth, hasSavings, hasAlloc, hasAlerts, hasRecs, hasSimulation];
  const dataCompleteness = completenessSignals.filter(Boolean).length / completenessSignals.length;

  const savingsRate = summary?.savingsRate ?? 0;
  const severeRisk = (summary?.alerts ?? []).some((alert) => alert.severity === 'high');
  const positiveSavings = savingsRate > 0;
  const consistency = severeRisk && positiveSavings ? 0.35 : 0.85;

  const yearsToGoal = summary?.simulation?.yearsToGoal;
  const expectedReturn = summary?.simulation?.expectedReturn ?? 0;
  const simulationReliability = yearsToGoal === null ? 0.55 : expectedReturn > 0 ? 0.9 : 0.65;

  const confidence = (0.5 * dataCompleteness) + (0.3 * consistency) + (0.2 * simulationReliability);
  return clamp(confidence, 0, 1);
}

function buildRuleBased(question: string, payload: CompactAdvisorPayload): AdvisorStructuredResponse {
  const summary = payload.financialSummary;
  const q = question.toLowerCase();

  const savingsRate = summary?.savingsRate ?? 0;
  const netWorthUsd = summary?.netWorthUsd ?? 0;
  const yearsToGoal = summary?.simulation?.yearsToGoal ?? null;

  const topAllocation = (summary?.allocations ?? [])[0];
  const topAlert = (summary?.alerts ?? [])[0];
  const topRec = (summary?.recommendations ?? [])[0];
  const memory = payload.memory;
  const pendingMemoryRecommendation = (memory?.lastRecommendations ?? []).find((recommendation) => recommendation.status === 'pending');

  const allocationImbalance = (topAllocation?.percentage ?? 0) > 50;
  const estimatedGoalNote = yearsToGoal === null
    ? 'Your current path does not reach the goal in the simulated horizon.'
    : `Estimated timeline to goal is about ${yearsToGoal} years.`;

  const weaknesses: string[] = [];
  if (savingsRate < 0.1) weaknesses.push(`Savings rate is ${Math.round(savingsRate * 1000) / 10}%, below a healthy 15% target.`);
  if (allocationImbalance) weaknesses.push(`Portfolio is concentrated in ${topAllocation?.assetType} (${Math.round((topAllocation?.percentage ?? 0) * 10) / 10}%).`);
  if (topAlert) weaknesses.push(short(topAlert.message, 120));

  const primaryWeakness = weaknesses[0] ?? 'No severe weaknesses detected, but optimization opportunities remain.';
  const memoryPrefix = memory?.lastQuestions?.length
    ? `Last time you asked about \"${memory.lastQuestions[0]}\". `
    : '';

  const actionCandidates = [
    topRec?.action ?? 'Increase monthly savings contributions by at least 10%.',
    allocationImbalance ? `Rebalance 10–20% away from ${topAllocation?.assetType ?? 'the largest position'} to reduce concentration risk.` : 'Review allocation quarterly to keep diversification balanced.',
    yearsToGoal === null ? 'Raise savings and/or reduce expenses to make the goal reachable in simulation.' : 'Maintain contributions and monitor progress monthly against timeline.',
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
      answer: short(`${estimatedGoalNote} ${primaryWeakness} Focus first on the top action below to accelerate progress.`),
      actions,
      priority,
      confidence: computeConfidence(payload),
    };
  }

  return {
    answer: short(`${memoryPrefix}${primaryWeakness} Net worth is ${netWorthUsd.toFixed(2)} USD. ${pendingMemoryRecommendation ? `You still have a pending step: ${pendingMemoryRecommendation.text}.` : 'Prioritize concrete improvements over generic changes.'}`),
    actions,
    priority,
    confidence: computeConfidence(payload),
  };
}

async function enhanceWithLLM(ruleBased: AdvisorStructuredResponse, payload: CompactAdvisorPayload): Promise<AdvisorStructuredResponse> {
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

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
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

  const data = await response.json().catch(() => null) as any;
  const outputText = data?.output_text;
  if (!outputText) return ruleBased;

  const parsed = JSON.parse(outputText) as Partial<AdvisorStructuredResponse>;

  if (!parsed.answer || !Array.isArray(parsed.actions) || !parsed.priority || typeof parsed.confidence !== 'number') {
    return ruleBased;
  }

  const actions = parsed.actions
    .map((action: any) => ({
      text: short(String(action?.text ?? ''), 180),
      impact: clamp(Number(action?.impact ?? 0), 0, 1),
    }))
    .filter((action) => action.text.length > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  if (actions.length === 0) return ruleBased;

  return {
    answer: short(parsed.answer, 900),
    actions,
    priority: parsed.priority,
    confidence: clamp(parsed.confidence, 0, 1),
  };
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({} as CompactAdvisorPayload));
  const userQuestion = String(body.userQuestion ?? '').trim();

  if (!userQuestion) return NextResponse.json({ message: 'Question is required.' }, { status: 400 });

  console.log('[ai] question_received', { userId: session.user.id, question: userQuestion });

  const ruleBased = buildRuleBased(userQuestion, body);
  console.log('[ai] rule_based_generated', { priority: ruleBased.priority, confidence: ruleBased.confidence });

  try {
    const llmResponse = await enhanceWithLLM(ruleBased, { ...body, userQuestion });
    if (llmResponse !== ruleBased) console.log('[ai] llm_response', { priority: llmResponse.priority, confidence: llmResponse.confidence });
    return NextResponse.json(llmResponse);
  } catch (error) {
    console.warn('[ai] fallback_used', { message: error instanceof Error ? error.message : 'unknown_error' });
    return NextResponse.json(ruleBased);
  }
}

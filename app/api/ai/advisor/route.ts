import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';

type AdvisorPayload = {
  userQuestion?: string;
  financialSummary?: {
    netWorth?: { usd?: number; ars?: number };
    savingsRate?: number;
    expenses?: number;
    income?: number;
    allocation?: Array<{ assetType: string; percentage: number }>;
    healthScore?: number;
    goalProgress?: number;
    simulation?: {
      monthsToGoal?: number | null;
      yearsToGoal?: number | null;
      optimisticYearsToGoal?: number | null;
      conservativeYearsToGoal?: number | null;
    };
  };
  alerts?: Array<{ severity: 'low' | 'medium' | 'high'; message: string }>;
  recommendations?: Array<{ action: string; reason: string }>;
  insights?: Array<{ title: string; type: string }>;
};

type AdvisorResponse = {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  suggestions?: string[];
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildRuleBased(question: string, payload: AdvisorPayload): AdvisorResponse {
  const q = question.toLowerCase();
  const savingsRate = payload.financialSummary?.savingsRate ?? 0;
  const healthScore = payload.financialSummary?.healthScore ?? 0;
  const yearsToGoal = payload.financialSummary?.simulation?.yearsToGoal ?? null;
  const topAlerts = (payload.alerts ?? []).slice(0, 2);
  const topRecs = (payload.recommendations ?? []).slice(0, 3);

  if (q.includes('when') || q.includes('reach') || q.includes('goal')) {
    if (yearsToGoal !== null) {
      return {
        answer: `Based on your current simulation, you may reach your goal in about ${yearsToGoal} years. Prioritize ${topRecs[0]?.action?.toLowerCase() || 'consistent monthly savings'} to improve this timeline.`,
        confidence: 'high',
        sources: ['simulation', 'recommendations'],
        suggestions: ['What if I reduce expenses by 10%?', 'How much faster with higher monthly savings?'],
      };
    }

    return {
      answer: 'Your current plan does not reach the goal within the selected horizon. Increase monthly savings or reduce expenses to close the gap.',
      confidence: 'medium',
      sources: ['simulation'],
      suggestions: ['How much should I save monthly to reach my goal?', 'What is my best realistic timeline?'],
    };
  }

  if (q.includes('doing well') || q.includes('am i') || q.includes('well')) {
    return {
      answer: `Your current health score is ${healthScore}/100 and savings rate is ${pct(savingsRate)}. ${healthScore >= 70 ? 'Overall performance is solid, but keep monitoring risk concentration.' : 'You have room to improve, especially by acting on the top recommendations.'}`,
      confidence: healthScore >= 70 ? 'high' : 'medium',
      sources: ['insights', 'dashboard', 'recommendations'],
      suggestions: ['What should I improve first?', 'Is my portfolio too concentrated?'],
    };
  }

  if (q.includes('improve') || q.includes('saving') || q.includes('finances')) {
    const actions = topRecs.map((rec) => rec.action).filter(Boolean);
    const alertsText = topAlerts.map((alert) => alert.message).join(' ');
    return {
      answer: `To improve your finances, focus first on: ${actions.join(' ')} ${alertsText ? `Current critical issues: ${alertsText}` : ''}`.trim(),
      confidence: actions.length > 0 ? 'high' : 'medium',
      sources: ['recommendations', 'alerts', 'insights'],
      suggestions: ['What one action gives the biggest impact?', 'Can you build a 90-day improvement plan?'],
    };
  }

  return {
    answer: 'I analyzed your dashboard, insights, and simulation. Ask about savings, portfolio risk, or goal timeline and I will provide precise next steps.',
    confidence: 'medium',
    sources: ['dashboard', 'insights', 'simulation'],
    suggestions: ['Am I saving enough?', 'What should I change in my portfolio?', 'When will I reach my goal?'],
  };
}

async function enhanceWithLLM(ruleBased: AdvisorResponse, payload: AdvisorPayload): Promise<AdvisorResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ruleBased;

  const systemPrompt = 'You are a professional financial advisor. Use the provided data. Do NOT hallucinate. Be precise and actionable.';

  const prompt = {
    userQuestion: payload.userQuestion,
    financialSummary: payload.financialSummary,
    recommendations: payload.recommendations,
    alerts: payload.alerts,
    ruleBasedDraft: ruleBased,
    outputFormat: {
      answer: 'string',
      confidence: 'high | medium | low',
      sources: ['string'],
      suggestions: ['string'],
    },
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
        { role: 'user', content: JSON.stringify(prompt) },
      ],
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) return ruleBased;
  const data = await response.json().catch(() => null) as any;
  const outputText = data?.output_text;
  if (!outputText) return ruleBased;

  const parsed = JSON.parse(outputText) as Partial<AdvisorResponse>;
  if (!parsed.answer || !parsed.confidence || !Array.isArray(parsed.sources)) return ruleBased;

  return {
    answer: parsed.answer,
    confidence: parsed.confidence,
    sources: parsed.sources,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ruleBased.suggestions,
  };
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({} as AdvisorPayload));
  const userQuestion = String(body.userQuestion ?? '').trim();
  if (!userQuestion) return NextResponse.json({ message: 'Question is required.' }, { status: 400 });

  console.log('[ai] question_received', { userId: session.user.id, question: userQuestion });

  const ruleBased = buildRuleBased(userQuestion, body);
  console.log('[ai] rule_based_generated', { confidence: ruleBased.confidence, sources: ruleBased.sources });

  try {
    const llmResponse = await enhanceWithLLM(ruleBased, { ...body, userQuestion });
    if (llmResponse !== ruleBased) console.log('[ai] llm_response', { confidence: llmResponse.confidence });
    return NextResponse.json(llmResponse);
  } catch (error) {
    console.warn('[ai] fallback_used', { message: error instanceof Error ? error.message : 'unknown_error' });
    return NextResponse.json(ruleBased);
  }
}

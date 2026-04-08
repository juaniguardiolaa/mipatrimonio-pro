import { useCallback, useEffect, useMemo, useState } from 'react';

export type MemoryQuestion = {
  text: string;
  timestamp: number;
};

export type MemoryRecommendation = {
  text: string;
  impact: number;
  createdAt: number;
  status: 'pending' | 'completed' | 'ignored';
};

export type AdvisorMemory = {
  lastQuestions: MemoryQuestion[];
  lastRecommendations: MemoryRecommendation[];
  lastSnapshotHash: string;
};

const STORAGE_KEY = 'advisor:v2:memory';
const QUESTION_TTL = 7 * 24 * 60 * 60 * 1000;
const RECOMMENDATION_TTL = 14 * 24 * 60 * 60 * 1000;

const defaultMemory: AdvisorMemory = {
  lastQuestions: [],
  lastRecommendations: [],
  lastSnapshotHash: '',
};

function sanitizeMemory(parsed: Partial<AdvisorMemory>): AdvisorMemory {
  const now = Date.now();
  const questions = Array.isArray(parsed.lastQuestions)
    ? parsed.lastQuestions.filter((item: any) => typeof item?.text === 'string' && typeof item?.timestamp === 'number')
    : [];

  const recommendations = Array.isArray(parsed.lastRecommendations)
    ? parsed.lastRecommendations.filter((item: any) => typeof item?.text === 'string' && typeof item?.createdAt === 'number' && typeof item?.impact === 'number')
    : [];

  const validQuestions = questions.filter((item) => now - item.timestamp <= QUESTION_TTL).slice(0, 5);
  const validRecommendations = recommendations.filter((item) => !(item.status === 'pending' && now - item.createdAt > RECOMMENDATION_TTL));

  if (validQuestions.length !== questions.length || validRecommendations.length !== recommendations.length) {
    console.log('[advisor:v2] memory_expired', {
      expiredQuestions: questions.length - validQuestions.length,
      expiredRecommendations: recommendations.length - validRecommendations.length,
    });
  }

  return {
    lastQuestions: validQuestions,
    lastRecommendations: validRecommendations,
    lastSnapshotHash: typeof parsed.lastSnapshotHash === 'string' ? parsed.lastSnapshotHash : '',
  };
}

function readMemory(): AdvisorMemory {
  if (typeof window === 'undefined') return defaultMemory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory;
    return sanitizeMemory(JSON.parse(raw) as Partial<AdvisorMemory>);
  } catch {
    return defaultMemory;
  }
}

export function useAdvisorMemory() {
  const [memory, setMemory] = useState<AdvisorMemory>(defaultMemory);

  useEffect(() => {
    // Hydration: read localStorage only on client after mount.
    // Initial state remains defaultMemory to match SSR output.
    setMemory(readMemory());
  }, []);

  const persist = useCallback((next: AdvisorMemory) => {
    const sanitized = sanitizeMemory(next);
    setMemory(sanitized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      console.log('[advisor:v2] memory_updated', {
        questions: sanitized.lastQuestions.length,
        recommendations: sanitized.lastRecommendations.length,
      });
    }
  }, []);

  const pushQuestion = useCallback((question: string) => {
    const normalized = question.trim();
    if (!normalized) return;
    const now = Date.now();
    const nextQuestions = [{ text: normalized, timestamp: now }, ...memory.lastQuestions.filter((item) => item.text !== normalized)].slice(0, 5);
    persist({ ...memory, lastQuestions: nextQuestions });
  }, [memory, persist]);

  const mergeRecommendations = useCallback((recommendations: Array<{ text: string; impact: number }>, snapshotHash: string) => {
    const now = Date.now();
    const existing = [...memory.lastRecommendations];

    recommendations.forEach((recommendation) => {
      const found = existing.find((item) => item.text === recommendation.text);
      if (!found) {
        existing.push({
          text: recommendation.text,
          impact: recommendation.impact,
          createdAt: now,
          status: 'pending',
        });
      } else if (found.status !== 'completed') {
        found.impact = recommendation.impact;
      }
    });

    const sorted = existing.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);

    persist({
      ...memory,
      lastRecommendations: sorted,
      lastSnapshotHash: snapshotHash,
    });
  }, [memory, persist]);

  const setRecommendationStatus = useCallback((text: string, status: 'pending' | 'completed' | 'ignored') => {
    const next = memory.lastRecommendations.map((recommendation) => {
      if (recommendation.text !== text) return recommendation;
      return { ...recommendation, status };
    });
    persist({ ...memory, lastRecommendations: next });
    console.log('[advisor:v2] recommendation_tracked', { text, status });
  }, [memory, persist]);

  const pendingRecommendations = useMemo(
    () => memory.lastRecommendations.filter((recommendation) => recommendation.status === 'pending'),
    [memory.lastRecommendations],
  );

  return {
    memory,
    pushQuestion,
    mergeRecommendations,
    setRecommendationStatus,
    pendingRecommendations,
  };
}

'use client';

import { FormEvent, useMemo, useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Bot } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAdvisor } from '@/src/hooks/useAdvisor';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
};

const QUICK_QUESTIONS = [
  'How can I improve my finances?',
  'Am I saving enough?',
  'What should I change in my portfolio?',
  'When will I reach my goal?',
];

export default function AiAnalysisPage() {
  const advisor = useAdvisor();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const canSend = useMemo(() => question.trim().length > 0 && !advisor.loading, [question, advisor.loading]);

  const sendQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || advisor.loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');

    try {
      const response = await advisor.askDebounced(trimmed);
      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        meta: `${response.confidence.toUpperCase()} confidence · sources: ${response.sources.join(', ')}`,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'I could not process that right now. Please try again.',
      }]);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendQuestion(question).catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="AI Analysis" subtitle="Hybrid advisor: rules + AI explanations from your real financial data." />

      <Card className="space-y-4 border border-gray-700 bg-gray-800/60 text-white">
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((quickQuestion) => (
            <Button key={quickQuestion} variant="outline" size="sm" onClick={() => sendQuestion(quickQuestion)} disabled={advisor.loading}>
              {quickQuestion}
            </Button>
          ))}
        </div>

        <div className="max-h-[440px] space-y-3 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/40 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400">Ask a question to get personalized financial guidance.</p>
          ) : messages.map((message) => (
            <div key={message.id} className={`rounded-lg p-3 ${message.role === 'user' ? 'bg-sky-950/30' : 'bg-emerald-950/20'}`}>
              <p className="text-xs uppercase tracking-wide text-gray-400">{message.role}</p>
              <p className="mt-1 text-sm text-gray-100">{message.content}</p>
              {message.meta ? <p className="mt-2 text-xs text-gray-400">{message.meta}</p> : null}
            </div>
          ))}
          {advisor.loading ? <p className="text-sm text-gray-300">Thinking…</p> : null}
          {advisor.error ? <p className="text-sm text-rose-300">Error: {advisor.error}</p> : null}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            placeholder="Ask about your savings, portfolio, or goal timeline..."
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="border-gray-700 bg-gray-900 text-white"
          />
          <Button type="submit" disabled={!canSend}>
            <Bot className="mr-2 h-4 w-4" />
            Ask
          </Button>
        </form>
      </Card>
    </div>
  );
}

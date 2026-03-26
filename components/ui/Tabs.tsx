import { cn } from '@/lib/utils';

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {tabs.map((tab) => (
        <button key={tab} onClick={() => onChange(tab)} className={cn('rounded-md px-3 py-1.5 text-sm transition', active === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
          {tab}
        </button>
      ))}
    </div>
  );
}

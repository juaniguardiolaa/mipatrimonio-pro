export function Tooltip({ label }: { label: string }) {
  return <span className="rounded bg-slate-900 px-2 py-1 text-xs text-white dark:bg-slate-100 dark:text-slate-900">{label}</span>;
}

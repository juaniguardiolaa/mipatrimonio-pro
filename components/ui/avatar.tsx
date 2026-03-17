export function Avatar({ initials }: { initials: string }) {
  return <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials}</div>;
}

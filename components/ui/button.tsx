export function Button({
  children,
  type = 'button',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(value);

export const formatDate = (date: string): string =>
  new Intl.DateTimeFormat('es-CL', {
    month: 'short',
    day: '2-digit'
  }).format(new Date(date));

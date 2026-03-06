export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/dashboard', '/assets', '/liabilities', '/onboarding']
};

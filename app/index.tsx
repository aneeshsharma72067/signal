import { Redirect } from 'expo-router';

import { useAuth } from '../src/context/AuthContext';

// Anchor route. Sends the user to the group their auth state allows. This is
// also where Stack.Protected redirects a guard failure, so it must always
// resolve to a reachable screen.
export default function Index() {
  const { session, needsUsername } = useAuth();

  if (!session) return <Redirect href="/onboarding" />;
  if (needsUsername) return <Redirect href="/username" />;
  return <Redirect href="/feed" />;
}

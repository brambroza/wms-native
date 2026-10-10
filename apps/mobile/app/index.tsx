import { Redirect } from 'expo-router';
import { Loading } from '../src/components/ui';
import { useSession } from '../src/lib/session';

export default function Index() {
  const { ready, session } = useSession();
  if (!ready) return <Loading />;
  return <Redirect href={session ? '/home' : '/login'} />;
}

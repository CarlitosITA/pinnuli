import { redirect } from 'next/navigation';
import { getCaller } from '@/server/auth';
import '../app/caregiver.css';
import LoginForm from './LoginForm';

export const metadata = { title: 'Accedi', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getCaller()) redirect('/app');
  return <LoginForm />;
}

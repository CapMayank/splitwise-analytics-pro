import { Metadata } from 'next';
import Dashboard from '@/components/Dashboard';

export const metadata: Metadata = {
  title: 'Splitwise Analytics Pro',
  description: 'Analyze your Splitwise exports with beautiful month-on-month and user-by-user insights.',
};

export default function Home() {
  return (
    <main className="container">
      <header className="mb-8">
        <h1 className="text-gradient">Splitwise Analytics Pro</h1>
        <p className="text-secondary mt-2">Get premium insights without the premium subscription.</p>
      </header>
      
      <Dashboard />
    </main>
  );
}

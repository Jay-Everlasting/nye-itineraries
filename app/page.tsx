import { getItineraries, getAudRate } from '@/lib/data';
import Planner from '@/components/Planner';

// Rebuild at most every 5 minutes. The rendered page is static, so the site
// stays up even if the Supabase project is paused or briefly unreachable.
export const revalidate = 300;

export default async function Home() {
  const [itineraries, audRate] = await Promise.all([getItineraries(), getAudRate()]);

  if (!itineraries.length) {
    return (
      <div style={{ padding: 48, maxWidth: 640, fontFamily: 'system-ui, sans-serif' }}>
        <h1>No itineraries yet</h1>
        <p>
          The database is reachable but empty. Run <code>npm run seed</code> to load your
          itineraries, then reload this page.
        </p>
      </div>
    );
  }

  return <Planner itineraries={itineraries} audRate={audRate} />;
}

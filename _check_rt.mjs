import pg from 'pg';
const DB = 'postgresql://postgres.enjyflztvyomrlzddavk:dnzHSG20u8X8Dmej@aws-1-sa-east-1.pooler.supabase.com:6543/postgres';
const c = new pg.Client(DB);
try {
  await c.connect();
  // Check current publications
  const r = await c.query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'");
  console.log('Currently published:', r.rows.map(x => x.tablename));
  
  // Add calendar_events if not present
  if (!r.rows.find(x => x.tablename === 'calendar_events')) {
    await c.query("ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events");
    console.log('Added calendar_events to realtime publication');
  } else {
    console.log('calendar_events already in publication');
  }

  // Check again
  const r2 = await c.query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'");
  console.log('Now published:', r2.rows.map(x => x.tablename));
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await c.end();
}

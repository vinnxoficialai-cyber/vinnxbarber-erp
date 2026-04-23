import fs from 'fs';

const T = 'sbp_9379023c10a0de575075b96c9cbf727acae39b96';
const PROJECT = 'enjyflztvyomrlzddavk';
const h = { Authorization: `Bearer ${T}` };

const functions = ['push-send', 'push-broadcast'];

for (const fn of functions) {
  const code = fs.readFileSync(`supabase/functions/${fn}/index.ts`, 'utf-8');
  
  // Create function
  const createRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/functions`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: fn,
      name: fn,
      body: code,
      verify_jwt: false,
    }),
  });
  
  if (createRes.status === 409) {
    // Already exists, update
    console.log(`${fn}: already exists, updating...`);
    const updateRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/functions/${fn}`, {
      method: 'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: code,
        verify_jwt: false,
      }),
    });
    console.log(`${fn} update:`, updateRes.status, await updateRes.text());
  } else {
    const d = await createRes.text();
    console.log(`${fn} create:`, createRes.status, d);
  }
}

// Verify
const listRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/functions`, { headers: h });
const fns = await listRes.json();
console.log('\nDeployed functions:', Array.isArray(fns) ? fns.map(f => f.slug) : fns);

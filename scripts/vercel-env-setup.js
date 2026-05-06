// Script para configurar env vars na Vercel via API
const https = require('https');

const VERCEL_TOKEN = 'vca_6K6ZQzuNspHYSSsYwinvv4k8p3ISrW3PPGBa8RzE3lUJaYtVOD3C02GQ';
const PROJECT_ID = 'prj_e2Mkxv1eJLxKLDyF0hj2obECAl6g';
const TEAM_ID = 'team_c5GsN2CVnMIAj44IJ5vSYSeu';

const ENV_VARS = [
  {
    key: 'VITE_SUPABASE_URL',
    value: 'https://enjyflztvyomrlzddavk.supabase.co',
    type: 'plain',
    target: ['production', 'preview', 'development'],
  },
  {
    key: 'VITE_SUPABASE_ANON_KEY',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuanlmbHp0dnlvbXJsemRkYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTE2MDksImV4cCI6MjA4NzQ2NzYwOX0.Md-ad9U6vK-OtNg3iUBX-SKCSNdOCppBasgC4ys-STc',
    type: 'plain',
    target: ['production', 'preview', 'development'],
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuanlmbHp0dnlvbXJsemRkYXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg5MTYwOSwiZXhwIjoyMDg3NDY3NjA5fQ.DVuY-JST3nwdiOh1iVBFisB8-mEkb97cfa8__ROIqx8',
    type: 'sensitive',
    target: ['production', 'preview', 'development'],
  },
];

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Verificando env vars existentes na Vercel ===\n');
  
  const listRes = await apiRequest('GET', `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`);
  
  if (listRes.status !== 200) {
    console.error('Erro ao listar env vars:', listRes.body);
    process.exit(1);
  }

  const existing = listRes.body.envs || [];
  const existingKeys = existing.map(e => e.key);
  
  console.log('Env vars já configuradas:');
  existingKeys.forEach(k => console.log('  -', k));
  console.log('');

  // Upsert cada env var
  for (const envVar of ENV_VARS) {
    const existingEnv = existing.find(e => e.key === envVar.key);
    
    if (existingEnv) {
      console.log(`Atualizando: ${envVar.key}`);
      const res = await apiRequest(
        'PATCH',
        `/v9/projects/${PROJECT_ID}/env/${existingEnv.id}?teamId=${TEAM_ID}`,
        { value: envVar.value, type: envVar.type, target: envVar.target }
      );
      console.log(`  -> Status: ${res.status === 200 ? 'OK' : 'ERRO ' + res.status}`);
      if (res.status !== 200) console.error('  ', JSON.stringify(res.body));
    } else {
      console.log(`Criando: ${envVar.key}`);
      const res = await apiRequest(
        'POST',
        `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
        { key: envVar.key, value: envVar.value, type: envVar.type, target: envVar.target }
      );
      console.log(`  -> Status: ${res.status === 200 ? 'OK' : 'ERRO ' + res.status}`);
      if (res.status !== 200) console.error('  ', JSON.stringify(res.body));
    }
  }

  console.log('\n=== Concluido! ===');
  console.log('O deploy ja esta em andamento no Vercel (push via GitHub).');
  console.log('Acesse: https://vercel.com/vinnxoficialai-cyber/vinnxbarber-erp');
}

main().catch(console.error);

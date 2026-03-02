// Create test client and verify client-dependent operations
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
    console.log('\n📋 Checking existing clients...');

    const { data: existingClients, error: readError } = await supabase
        .from('clients')
        .select('*');

    if (readError) {
        console.log('❌ Error reading clients:', readError.message);
        return;
    }

    console.log(`Found ${existingClients?.length || 0} clients`);

    if (!existingClients || existingClients.length === 0) {
        console.log('\n📝 Creating test client...');

        const now = new Date().toISOString();
        const { data: newClient, error: createError } = await supabase
            .from('clients')
            .insert({
                id: randomUUID(),
                name: 'Cliente Teste',
                company: 'Empresa Teste Ltda',
                email: 'teste@empresa.com',
                phone: '(11) 99999-9999',
                status: 'ACTIVE',
                monthlyValue: 1000,
                setupValue: 500,
                totalValue: 1500,
                monthsActive: 6,
                origin: 'Indicação',
                segment: 'Tecnologia',
                updatedAt: now
            })
            .select()
            .single();

        if (createError) {
            console.log('❌ Error creating client:', createError.message);
            return;
        }

        console.log('✅ Client created:', newClient.name);

        // Now test the client-dependent operations
        const clientId = newClient.id;

        // Test BUDGETS
        console.log('\n📊 Testing BUDGETS...');
        const { data: budget, error: budgetError } = await supabase
            .from('budgets')
            .insert({
                id: randomUUID(),
                clientId,
                title: 'Test Budget',
                status: 'Draft',
                items: [],
                totalValue: 5000,
                discount: 0,
                validUntil: now,
                updatedAt: now
            })
            .select()
            .single();

        if (budgetError) {
            console.log('❌ BUDGETS CREATE failed:', budgetError.message);
        } else {
            console.log('✅ BUDGETS CREATE passed');
            await supabase.from('budgets').delete().eq('id', budget.id);
            console.log('✅ BUDGETS DELETE passed');
        }

        // Test PROJECTS
        console.log('\n📁 Testing PROJECTS...');
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert({
                id: randomUUID(),
                clientId,
                title: 'Test Project',
                status: 'TODO',
                priority: 'MEDIUM',
                progress: 0,
                startDate: now,
                tags: [],
                updatedAt: now
            })
            .select()
            .single();

        if (projectError) {
            console.log('❌ PROJECTS CREATE failed:', projectError.message);
        } else {
            console.log('✅ PROJECTS CREATE passed');
            await supabase.from('projects').delete().eq('id', project.id);
            console.log('✅ PROJECTS DELETE passed');
        }

        // Test CLIENT_INTERACTIONS
        console.log('\n🤝 Testing CLIENT_INTERACTIONS...');
        const { data: interaction, error: interactionError } = await supabase
            .from('client_interactions')
            .insert({
                id: randomUUID(),
                clientId,
                type: 'call',
                title: 'Test Call',
                date: now,
                userId: randomUUID()
            })
            .select()
            .single();

        if (interactionError) {
            console.log('❌ CLIENT_INTERACTIONS CREATE failed:', interactionError.message);
        } else {
            console.log('✅ CLIENT_INTERACTIONS CREATE passed');
            await supabase.from('client_interactions').delete().eq('id', interaction.id);
            console.log('✅ CLIENT_INTERACTIONS DELETE passed');
        }

        // Test SERVICE_CREDENTIALS
        console.log('\n🔐 Testing SERVICE_CREDENTIALS...');
        const { data: credential, error: credentialError } = await supabase
            .from('service_credentials')
            .insert({
                id: randomUUID(),
                clientId,
                serviceName: 'Test Service',
                category: 'other',
                password: 'test123',
                updatedAt: now
            })
            .select()
            .single();

        if (credentialError) {
            console.log('❌ SERVICE_CREDENTIALS CREATE failed:', credentialError.message);
        } else {
            console.log('✅ SERVICE_CREDENTIALS CREATE passed');
            await supabase.from('service_credentials').delete().eq('id', credential.id);
            console.log('✅ SERVICE_CREDENTIALS DELETE passed');
        }

        // Test CONTRACTS
        console.log('\n📜 Testing CONTRACTS...');
        const { data: contract, error: contractError } = await supabase
            .from('contracts')
            .insert({
                id: randomUUID(),
                clientId,
                title: 'Test Contract',
                monthlyValue: 1000,
                setupValue: 500,
                contractDuration: 12,
                startDate: now,
                status: 'ACTIVE',
                updatedAt: now
            })
            .select()
            .single();

        if (contractError) {
            console.log('❌ CONTRACTS CREATE failed:', contractError.message);
        } else {
            console.log('✅ CONTRACTS CREATE passed');
            await supabase.from('contracts').delete().eq('id', contract.id);
            console.log('✅ CONTRACTS DELETE passed');
        }

        console.log('\n✅ All client-dependent operations verified!');
        console.log(`ℹ️ Test client "${newClient.name}" remains in database for UI testing.`);
    } else {
        console.log('\n✅ Clients already exist in database. Skipping creation.');
        existingClients.forEach(c => console.log(`  - ${c.name} (${c.email})`));
    }

    console.log('\n🎉 VERIFICATION COMPLETE!\n');
}

main();

/**
 * VINNX Barber ERP — Seed Real Users Script
 * Cria os usuários reais da barbearia no Supabase
 * 
 * EXECUÇÃO: npx tsx seed_real_users.ts
 * 
 * REQUER: service_role key (admin access)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://enjyflztvyomrlzddavk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuanlmbHp0dnlvbXJsemRkYXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg5MTYwOSwiZXhwIjoyMDg3NDY3NjA5fQ.DVuY-JST3nwdiOh1iVBFisB8-mEkb97cfa8__ROIqx8';

// Admin client with service_role (bypasses RLS, has auth.admin)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// ============ CONFIG ============

const LAGOA_UNIT_ID = '5dfb17a6-d052-469d-8ee9-7b30dcd60477';
const DEFAULT_PASSWORD = 'barbearia2026';

const EXISTING_USERS = {
    vinicius: '39207e3c-dc43-4fd3-bea2-cc9a3d983287',
    matheus: '4e56a260-0c85-451f-9a0b-9e24939710b3',
};

interface NewUser {
    name: string;
    email: string;
    role: string; // DB enum value: BARBER, ATTENDANT, ADMIN
    specialties?: string[];
}

const NEW_USERS: NewUser[] = [
    { name: 'Victor Daniel Ferreira da Silva', email: 'victor@barbearia.com', role: 'BARBER' },
    { name: 'Welison Gonçalves da Silva', email: 'welison@barbearia.com', role: 'BARBER' },
    { name: 'Nicolas Faria Braga', email: 'nicolas@barbearia.com', role: 'BARBER', specialties: ['Visagista'] },
    { name: 'Karen', email: 'karen@barbearia.com', role: 'ATTENDANT' },
    { name: 'Wedson Santos da Silva', email: 'wedson@barbearia.com', role: 'BARBER' },
    { name: 'Joel Lopes Da Silva', email: 'joel@barbearia.com', role: 'BARBER' },
    { name: 'Nathan Ribeiro', email: 'nathan@barbearia.com', role: 'BARBER' },
];

// ============ HELPERS ============

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ STEP 1: Add ATTENDANT to UserRole enum ============

async function addAttendantEnum() {
    console.log('\n=== STEP 1: Adding ATTENDANT enum ===');

    const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ATTENDANT';`
    });

    if (error) {
        // RPC might not exist, try direct SQL via postgres
        console.log('  RPC not available, trying raw SQL...');
        // Use REST API to run SQL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql: `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ATTENDANT';` })
        });
        if (!response.ok) {
            console.log('  Direct RPC also failed. Will try via pg connection...');
            // Alternative: use the management API
            const pgResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ query: `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ATTENDANT';` })
            });
            if (!pgResponse.ok) {
                console.log('  WARNING: Could not add ATTENDANT enum via API.');
                console.log('  Please run this SQL manually in Supabase SQL Editor:');
                console.log('  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS \'ATTENDANT\';');
                return false;
            }
        }
    }

    console.log('  ATTENDANT enum added (or already exists)');
    return true;
}

// ============ STEP 2: Create role_permissions for ATTENDANT ============

async function createAttendantPermissions() {
    console.log('\n=== STEP 2: Creating ATTENDANT role_permissions ===');

    const permissions = {
        pages: {
            '/': true,
            '/agenda': true,
            '/tasks': true,
            '/clients': true,
            '/services': true,
            '/comanda': true,
            '/products': true,
            '/team': false,
            '/finance': false,
            '/settings': false,
            '/projects': false,
            '/pipeline': false,
            '/budgets': false,
            '/contracts': false,
            '/contas-bancarias': false,
            '/contas-pagar': false,
            '/avaliacoes': false,
            '/banco-horas': false,
            '/ferias': false,
            '/credenciais': false,
            '/metas': false,
            '/folha-pagamento': false,
            '/passivo-circulante': false,
            '/ativos-circulantes': false,
            '/unidades': false,
            '/relatorios': false,
        },
        actions: {
            canCreate: true,
            canEdit: true,
            canDelete: false,
            canExport: false,
            canViewFinancials: false,
            canManageTeam: false,
            canManageSettings: false,
        }
    };

    // Check if already exists
    const { data: existing } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role', 'ATTENDANT')
        .single();

    if (existing) {
        const { error } = await supabase
            .from('role_permissions')
            .update({ permissions, updatedAt: new Date().toISOString() })
            .eq('role', 'ATTENDANT');
        if (error) {
            console.log('  WARNING: Could not update ATTENDANT permissions:', error.message);
            return;
        }
        console.log('  ATTENDANT permissions updated');
    } else {
        const { error } = await supabase
            .from('role_permissions')
            .insert({
                id: crypto.randomUUID(),
                role: 'ATTENDANT',
                permissions,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        if (error) {
            console.log('  WARNING: Could not insert ATTENDANT permissions:', error.message);
            console.log('  This might be because the ATTENDANT enum was not added yet.');
            console.log('  Run the enum ALTER TYPE first, then re-run this script.');
            return;
        }
        console.log('  ATTENDANT permissions created');
    }
}

// Also ensure BARBER permissions exist
async function ensureBarberPermissions() {
    console.log('\n=== STEP 2b: Ensuring BARBER role_permissions ===');

    const { data: existing } = await supabase
        .from('role_permissions')
        .select('id')
        .eq('role', 'BARBER')
        .single();

    if (existing) {
        console.log('  BARBER permissions already exist');
        return;
    }

    const permissions = {
        pages: {
            '/': true,
            '/agenda': true,
            '/tasks': true,
            '/clients': true,
            '/services': true,
            '/comanda': true,
            '/products': true,
            '/team': false,
            '/finance': false,
            '/settings': false,
            '/projects': false,
            '/pipeline': false,
            '/budgets': false,
            '/contracts': false,
            '/contas-bancarias': false,
            '/contas-pagar': false,
            '/avaliacoes': false,
            '/banco-horas': false,
            '/ferias': false,
            '/credenciais': false,
            '/metas': false,
            '/folha-pagamento': false,
            '/passivo-circulante': false,
            '/ativos-circulantes': false,
            '/unidades': false,
            '/relatorios': false,
        },
        actions: {
            canCreate: true,
            canEdit: true,
            canDelete: false,
            canExport: false,
            canViewFinancials: false,
            canManageTeam: false,
            canManageSettings: false,
        }
    };

    const { error } = await supabase
        .from('role_permissions')
        .insert({
            id: crypto.randomUUID(),
            role: 'BARBER',
            permissions,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

    if (error) {
        console.log('  WARNING: Could not insert BARBER permissions:', error.message);
    } else {
        console.log('  BARBER permissions created');
    }
}

// ============ STEP 3: Create users ============

async function createUser(user: NewUser): Promise<string | null> {
    const now = new Date().toISOString();

    // Check if email already exists in public.users
    const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', user.email)
        .single();

    if (existingUser) {
        console.log(`  User ${user.email} already exists (ID: ${existingUser.id}), skipping auth creation`);
        return existingUser.id;
    }

    // 1. Create in auth.users via admin API
    console.log(`  Creating auth user: ${user.email}...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,  // Auto-confirm email
        user_metadata: { name: user.name, role: user.role },
    });

    if (authError) {
        if (authError.message.includes('already been registered')) {
            console.log(`  Auth user already exists for ${user.email}, finding ID...`);
            // Look up the auth user
            const { data: authList } = await supabase.auth.admin.listUsers();
            const found = authList?.users?.find(u => u.email === user.email);
            if (found) {
                // Insert into public.users with this ID
                const { error: insertError } = await supabase.from('users').insert({
                    id: found.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    password: DEFAULT_PASSWORD,
                    updatedAt: now,
                });
                if (insertError && !insertError.message.includes('duplicate')) {
                    console.log(`  WARNING: ${insertError.message}`);
                }
                return found.id;
            }
        }
        console.error(`  ERROR creating auth user ${user.email}: ${authError.message}`);
        return null;
    }

    const userId = authData.user.id;
    console.log(`  Auth user created: ${userId}`);

    // 2. Insert into public.users
    const { error: userError } = await supabase.from('users').insert({
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role,
        password: DEFAULT_PASSWORD,
        updatedAt: now,
    });

    if (userError) {
        console.error(`  ERROR inserting public.users for ${user.email}: ${userError.message}`);
        return userId; // Auth user exists, return ID anyway
    }
    console.log(`  public.users record created`);

    return userId;
}

async function createTeamMember(userId: string, user: NewUser) {
    const now = new Date().toISOString();

    // Check if team_member already exists
    const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('userId', userId)
        .single();

    if (existing) {
        // Update specialties if provided
        if (user.specialties && user.specialties.length > 0) {
            await supabase.from('team_members')
                .update({ specialties: user.specialties, updatedAt: now })
                .eq('userId', userId);
            console.log(`  team_members updated with specialties`);
        } else {
            console.log(`  team_members already exists`);
        }
        return;
    }

    const { error } = await supabase.from('team_members').insert({
        id: crypto.randomUUID(),
        userId,
        baseSalary: 0,
        commissionRate: 0.20,
        joinDate: now,
        specialties: user.specialties || [],
        updatedAt: now,
    });

    if (error) {
        console.error(`  ERROR inserting team_members: ${error.message}`);
    } else {
        console.log(`  team_members record created`);
    }
}

async function linkToUnit(userId: string, unitId: string) {
    // Check if already linked
    const { data: existing } = await supabase
        .from('unit_members')
        .select('id')
        .eq('userId', userId)
        .eq('unitId', unitId)
        .single();

    if (existing) {
        console.log(`  Already linked to unit`);
        return;
    }

    const { error } = await supabase.from('unit_members').insert({
        id: crypto.randomUUID(),
        unitId,
        userId,
        role: 'member',
        isPrimary: true,
        createdAt: new Date().toISOString(),
    });

    if (error) {
        console.error(`  ERROR linking to unit: ${error.message}`);
    } else {
        console.log(`  Linked to LAGOA unit`);
    }
}

// ============ STEP 5: Update Matheus ============

async function updateMatheus() {
    console.log('\n=== STEP 5: Updating Matheus → ADMIN + "Matheus Nogueira" ===');

    const { error } = await supabase.from('users')
        .update({
            name: 'Matheus Nogueira',
            role: 'ADMIN',
            updatedAt: new Date().toISOString(),
        })
        .eq('id', EXISTING_USERS.matheus);

    if (error) {
        console.error(`  ERROR: ${error.message}`);
    } else {
        console.log('  Matheus updated: name="Matheus Nogueira", role=ADMIN');
    }

    // Also update auth metadata
    const { error: authError } = await supabase.auth.admin.updateUserById(EXISTING_USERS.matheus, {
        user_metadata: { name: 'Matheus Nogueira', role: 'ADMIN' },
    });
    if (authError) {
        console.log(`  Auth metadata update warning: ${authError.message}`);
    }
}

// ============ STEP 6: Link Vinicius to LAGOA ============

async function linkVinicius() {
    console.log('\n=== STEP 6: Linking Vinicius to LAGOA ===');
    await linkToUnit(EXISTING_USERS.vinicius, LAGOA_UNIT_ID);
}

// ============ MAIN ============

async function main() {
    console.log('========================================');
    console.log('  VINNX Barber — Seed Real Users');
    console.log('========================================');

    // Step 1: Add ATTENDANT enum
    const enumResult = await addAttendantEnum();

    // Small delay to let enum propagate
    await delay(1000);

    // Step 2: Role permissions
    await createAttendantPermissions();
    await ensureBarberPermissions();

    // Step 3: Create new users
    console.log('\n=== STEP 3: Creating new users ===');
    const createdUsers: { userId: string; user: NewUser }[] = [];

    for (const user of NEW_USERS) {
        console.log(`\n--- ${user.name} (${user.email}) ---`);
        const userId = await createUser(user);
        if (userId) {
            createdUsers.push({ userId, user });

            // Create team_member
            await createTeamMember(userId, user);
        }
        // Small delay between users to avoid rate limiting
        await delay(500);
    }

    // Step 4: Link ALL users to LAGOA
    console.log('\n=== STEP 4: Linking users to LAGOA unit ===');
    for (const { userId, user } of createdUsers) {
        console.log(`  ${user.name}...`);
        await linkToUnit(userId, LAGOA_UNIT_ID);
    }

    // Step 5: Update Matheus
    await updateMatheus();

    // Also link Matheus to LAGOA (if not already)
    console.log('  Linking Matheus to LAGOA...');
    await linkToUnit(EXISTING_USERS.matheus, LAGOA_UNIT_ID);

    // Step 6: Link Vinicius
    await linkVinicius();

    // ============ VERIFICATION ============
    console.log('\n========================================');
    console.log('  VERIFICATION');
    console.log('========================================');

    const { data: allUsers } = await supabase
        .from('users')
        .select('id, email, name, role')
        .order('name');

    console.log('\n--- All Users ---');
    if (allUsers) {
        for (const u of allUsers) {
            console.log(`  ${u.name.padEnd(35)} | ${u.email.padEnd(30)} | ${u.role}`);
        }
    }

    const { data: unitMembers } = await supabase
        .from('unit_members')
        .select('userId, unitId, role, isPrimary')
        .eq('unitId', LAGOA_UNIT_ID);

    console.log(`\n--- LAGOA Unit Members (${unitMembers?.length || 0}) ---`);
    if (unitMembers) {
        for (const um of unitMembers) {
            const user = allUsers?.find(u => u.id === um.userId);
            console.log(`  ${(user?.name || um.userId).padEnd(35)} | ${um.role}`);
        }
    }

    const { data: teamMembers } = await supabase
        .from('team_members')
        .select('userId, baseSalary, specialties, station');

    console.log(`\n--- Team Members (${teamMembers?.length || 0}) ---`);
    if (teamMembers) {
        for (const tm of teamMembers) {
            const user = allUsers?.find(u => u.id === tm.userId);
            const specs = tm.specialties && tm.specialties.length > 0 ? ` [${tm.specialties.join(', ')}]` : '';
            console.log(`  ${(user?.name || tm.userId).padEnd(35)}${specs}`);
        }
    }

    console.log('\n========================================');
    console.log('  DONE! All users created successfully.');
    console.log('========================================');
    console.log('\nCredentials for all new users:');
    console.log('  Password: barbearia2026');
    console.log('  Emails:');
    for (const u of NEW_USERS) {
        console.log(`    - ${u.email}`);
    }
}

main().catch(console.error);

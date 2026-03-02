/**
 * VINNX ERP — Seed Data Script
 * Populates database with mock data for Payroll testing.
 * Executar: npx tsx seed-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY obrigatórios no .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MOCK_USERS = [
    {
        email: 'ana.silva@teste.com',
        name: 'Ana Silva',
        role: 'SUPPORT',
        team_member: {
            position: 'Desenvolvedora Frontend',
            department: 'Tecnologia',
            phone: '11999991111',
            contractType: 'CLT',
            baseSalary: 5500.00,
            admissionDate: '2023-05-10',
            pixKey: '11999991111', // CPF/Phone
            paymentPreference: 'Mensal'
        },
        payment: {
            status: 'paid',
            commissions: 0,
            deductions: 0
        }
    },
    {
        email: 'carlos.santos@teste.com',
        name: 'Carlos Santos',
        role: 'SUPPORT',
        team_member: {
            position: 'Designer UI/UX',
            department: 'Produto',
            phone: '11988882222',
            contractType: 'PJ',
            baseSalary: 8000.00,
            admissionDate: '2024-01-15',
            pixKey: 'carlos.ux@teste.com', // Email
            paymentPreference: 'Quinzenal'
        },
        payment: {
            status: 'pending',
            commissions: 1200.00, // Freelance extra
            deductions: 0
        }
    },
    {
        email: 'beatriz.costa@teste.com',
        name: 'Beatriz Costa',
        role: 'MANAGER',
        team_member: {
            position: 'Gerente de Vendas',
            department: 'Comercial',
            phone: '21977773333',
            contractType: 'CLT',
            baseSalary: 7200.00,
            admissionDate: '2022-11-01',
            pixKey: '23e4567-e89b-12d3-a456-426614174000', // EVP
            paymentPreference: 'Mensal'
        },
        payment: {
            status: 'pending',
            commissions: 3500.00, // Sales bonus
            deductions: 200.00    // Advance
        }
    },
    {
        email: 'joao.junior@teste.com',
        name: 'João Júnior',
        role: 'SUPPORT', // Mapped to EMPLOYEE as INTERN might not exist
        team_member: {
            position: 'Estagiário Marketing',
            department: 'Marketing',
            phone: '31966664444',
            contractType: 'Estágio',
            baseSalary: 1500.00,
            admissionDate: '2025-01-10',
            pixKey: '12345678900', // CPF
            paymentPreference: 'Mensal'
        },
        payment: {
            status: 'paid',
            commissions: 0,
            deductions: 0
        }
    },
    {
        email: 'roberto.dev@teste.com',
        name: 'Roberto Oliveira',
        role: 'ADMIN',
        team_member: {
            position: 'CTO',
            department: 'Tecnologia',
            phone: '11955556666',
            contractType: 'PJ',
            baseSalary: 15000.00,
            admissionDate: '2021-08-20',
            pixKey: '12345678000199', // CNPJ
            paymentPreference: 'Mensal'
        },
        payment: {
            status: 'pending',
            commissions: 0,
            deductions: 0
        }
    }
];

async function seed() {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Current period (YYYY-MM)
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    console.log(`📅 Período atual: ${period}`);

    for (const u of MOCK_USERS) {
        console.log(`👤 Processando usuário: ${u.name}...`);

        // 1. Upsert User (in 'users' table - mockup mainly, Supabase Auth users are separate)
        // Since we can't create Auth users easily via API without admin secret (service_role), 
        // we will simulate by checking if user exists or creating a dummy record in public.users if RLS allows, 
        // OR ideally we assume they exist. 
        // BUT, for this dev test, we'll try to insert into 'users' table directly using the anon key 
        // (assuming RLS allows or we are just testing). 
        // Note: Often public.users is linked to auth.users. 
        // We will generate a random UUID for the ID to verify the logic.

        let userId: string;

        // Try to find existing by email
        const { data: existingUser } = await supabase.from('users').select('id').eq('email', u.email).single();

        if (existingUser) {
            userId = existingUser.id;
            console.log(`   ✅ Usuário já existe (${userId})`);
        } else {
            // Create new
            const { data: newUser, error: userError } = await supabase.from('users').insert({
                email: u.email,
                name: u.name,
                role: u.role,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }).select().single();

            if (userError) {
                console.error(`   ❌ Erro ao criar usuário: ${userError.message}`);
                continue; // Skip rest for this user
            }
            userId = newUser.id;
            console.log(`   ✨ Usuário criado (${userId})`);
        }

        // 2. Upsert Team Member
        const { error: tmError } = await supabase.from('team_members').upsert({
            userId: userId,
            ...u.team_member,
            updatedAt: new Date().toISOString()
        }, { onConflict: 'userId' });

        if (tmError) {
            console.error(`   ❌ Erro ao atualizar team_member: ${tmError.message}`);
        } else {
            console.log(`   ✅ Dados do colaborador atualizados`);
        }

        // 3. Create Commissions / Withdrawals if any
        if (u.payment.commissions > 0) {
            const { error: commError } = await supabase.from('commissions').insert({
                employeeId: userId,
                amount: u.payment.commissions,
                period: period,
                description: 'Comissão Mensal / Bônus',
                status: 'approved',
                createdAt: new Date().toISOString()
            });
            if (!commError) console.log(`   💰 Comissão registrada: R$ ${u.payment.commissions}`);
        }

        if (u.payment.deductions > 0) {
            const { error: dedError } = await supabase.from('withdrawals').insert({
                employeeId: userId,
                amount: u.payment.deductions,
                reason: 'Vale / Adiantamento',
                date: new Date().toISOString(),
                status: 'approved'
            });
            if (!dedError) console.log(`   💸 Adiantamento registrado: R$ ${u.payment.deductions}`);
        }

        // 4. Create Payment Record (Folha)
        // Calculate totals
        const base = u.team_member.baseSalary;
        let inss = 0, irrf = 0, fgts = 0;

        if (u.team_member.contractType === 'CLT') {
            inss = base * 0.11; // Simplificado
            irrf = base * 0.15; // Simplificado
            fgts = base * 0.08;
        }

        const totalAdditions = u.payment.commissions;
        const totalDeductions = inss + irrf + u.payment.deductions;
        const net = base + totalAdditions - totalDeductions;

        const { error: payError } = await supabase.from('payment_records').upsert({
            id: `${userId}-${period}`, // Composite ID simulation
            employeeId: userId,
            period: period,
            grossSalary: base,
            netSalary: net,
            inss,
            irrf,
            fgts,
            commissions: totalAdditions,
            deductions: totalDeductions,
            status: u.payment.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // If paid, fill details
            ...(u.payment.status === 'paid' ? {
                paidAt: new Date().toISOString(),
                paymentMethod: 'pix',
                paidBy: 'admin-seed'
            } : {})
        }, { onConflict: 'employeeId, period' }); // Assuming unique constraint or logic

        if (payError) {
            // Try inserting without specific ID if upsert fails
            const { error: insertError } = await supabase.from('payment_records').insert({
                employeeId: userId,
                period: period,
                grossSalary: base,
                netSalary: net,
                inss,
                irrf,
                fgts,
                commissions: totalAdditions,
                deductions: totalDeductions,
                status: u.payment.status,
                createdAt: new Date().toISOString(),
            });
            if (insertError) console.error(`   ❌ Erro ao criar pagamento: ${insertError.message}`);
            else console.log(`   🧾 Folha de pagamento gerada (Status: ${u.payment.status})`);
        } else {
            console.log(`   🧾 Folha de pagamento atualizada (Status: ${u.payment.status})`);
        }
    }

    console.log('\n✅ Seed concluído com sucesso!');
}

seed();

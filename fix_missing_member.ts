
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingMember() {
    console.log('--- REPARO DE DADOS: CRIAR TEAM MEMBER FALTANTE ---');

    try {
        // Buscar o admin
        const adminEmail = 'vinnxoficialai@gmail.com';
        const user = await prisma.user.findUnique({
            where: { email: adminEmail },
            include: { teamMember: true }
        });

        if (!user) {
            console.error('Usuário admin não encontrado!');
            return;
        }

        console.log(`Usuário encontrado: ${user.name} (${user.id})`);

        if (user.teamMember) {
            console.log('Este usuário JÁ TEM TeamMember. O problema não é falta de registro.');
            console.log('ID do TeamMember:', user.teamMember.id);
        } else {
            console.log('Usuário SEM TeamMember. Criando agora...');

            const newMember = await prisma.teamMember.create({
                data: {
                    id: user.id + '_tm',
                    userId: user.id,
                    baseSalary: 0,
                    commissionRate: 0.20,
                    joinDate: new Date(),
                    totalSales: 0,
                    totalCommissions: 0,
                    // Campos opcionais iniciais
                }
            });

            console.log('TeamMember criado com sucesso!', newMember);
        }

    } catch (error) {
        console.error('Erro no reparo:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixMissingMember();

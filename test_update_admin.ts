
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUpdateAdmin() {
    console.log('--- TESTE UPDATE BACKEND ---');

    const adminId = '266f5c67-8e14-4313-ad51-4c51104572fe';
    const newBirthDate = new Date('1990-01-01T00:00:00.000Z');

    console.log(`Tentando atualizar birthDate para ${newBirthDate.toISOString()}...`);

    try {
        const updated = await prisma.teamMember.update({
            where: { userId: adminId },
            data: {
                birthDate: newBirthDate
            }
        });

        console.log('Update SUCESSO! Dados retornados:', updated);
    } catch (error) {
        console.error('Update FALHOU:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testUpdateAdmin();


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditDatabase() {
    console.log('--- AUDITORIA DIRETA DO BANCO (PRISMA) ---');

    try {
        // 1. Listar usuários e seus TeamMembers
        const users = await prisma.user.findMany({
            include: {
                teamMember: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        console.log(`Encontrados ${users.length} usuários.`);

        for (const user of users) {
            console.log(`\nUser: ${user.name} (${user.email}) - ID: ${user.id}`);

            if (user.teamMember) {
                console.log('  TeamMember encontrado!');
                console.log('  ID:', user.teamMember.id);
                console.log('  Dados RAW:', JSON.stringify(user.teamMember, null, 2));
            } else {
                console.log('  TeamMember: NÃO ENCONTRADO (NULL)');
                console.log('  Isso confirma que o JOIN falha se feito via API, ou o registro não existe.');
            }
        }

        // 2. Verificar estrutura da tabela via $queryRaw (se possível) para ver colunas
        // Isso é útil para ver se as colunas estão com camelCase ou snake_case no banco real
        console.log('\n--- VERIFICANDO COLUNAS DA TABELA TEAM_MEMBERS ---');
        const columns: any[] = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'team_members';
    `;

        console.log('Colunas encontradas:');
        columns.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));

    } catch (error) {
        console.error('Erro na auditoria:', error);
    } finally {
        await prisma.$disconnect();
    }
}

auditDatabase();

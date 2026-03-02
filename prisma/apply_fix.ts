import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    try {
        const sqlPath = path.join(process.cwd(), 'prisma', 'update_team_members.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying migration from:', sqlPath);

        // Split by semicolon if needed, but DO block handles it as one statement usually.
        // However, the file has a DO block which is one statement.

        await prisma.$executeRawUnsafe(sql);

        console.log('✅ Migration applied successfully.');
    } catch (error) {
        console.error('❌ Error applying migration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

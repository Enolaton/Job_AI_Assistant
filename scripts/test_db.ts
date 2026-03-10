import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        const userCount = await prisma.user.count()
        console.log('User count:', userCount)
    } catch (error) {
        console.error('Prisma connection error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()

import prisma from './services/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true
    }
  });
  console.log('USERS IN DB:', JSON.stringify(users, null, 2));
}

main().catch(console.error);

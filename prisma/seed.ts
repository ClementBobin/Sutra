import bcrypt from 'bcrypt';
import { PrismaClient, Priority, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const alicePassword = await bcrypt.hash('alice-password', 12);
  const bobPassword = await bcrypt.hash('bob-password', 12);

  const alice = await prisma.user.create({
    data: { name: 'Alice', email: 'alice@example.com', password: alicePassword }
  });

  const bob = await prisma.user.create({
    data: { name: 'Bob', email: 'bob@example.com', password: bobPassword }
  });

  const aliceProject = await prisma.project.create({
    data: {
      name: 'Alice Project',
      description: 'Owned by Alice',
      ownerId: alice.id
    }
  });

  const bobProject = await prisma.project.create({
    data: {
      name: 'Bob Project',
      description: 'Owned by Bob',
      ownerId: bob.id
    }
  });

  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Plan roadmap',
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
        projectId: aliceProject.id,
        assigneeId: alice.id
      }
    }),
    prisma.task.create({
      data: {
        title: 'Implement auth',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.MEDIUM,
        projectId: aliceProject.id,
        assigneeId: bob.id
      }
    }),
    prisma.task.create({
      data: {
        title: 'Write docs',
        status: TaskStatus.DONE,
        priority: Priority.LOW,
        projectId: aliceProject.id
      }
    }),
    prisma.task.create({
      data: {
        title: 'Set up CI',
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        projectId: bobProject.id,
        assigneeId: bob.id
      }
    }),
    prisma.task.create({
      data: {
        title: 'Fix onboarding',
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        projectId: bobProject.id,
        assigneeId: alice.id
      }
    })
  ]);

  console.log({ alice, bob, aliceProject, bobProject, tasks });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

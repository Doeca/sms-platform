import { prisma } from "./prisma";

export async function resetDatabase() {
  await prisma.message.deleteMany();
  await prisma.messageSource.deleteMany();
}

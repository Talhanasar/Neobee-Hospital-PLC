import { prisma } from "@/lib/prisma";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes I,O,0,1 — verbatim from prototype

// NEO-#### — sequential, zero-padded to 4, collision-checked against DB.
export async function genUniqueId(): Promise<string> {
  const count = await prisma.investment.count();
  let k = count + 1;
  // loop until an unused NEO-#### is found
  // (pad to 4; grows beyond 4 digits automatically if ever needed)
  while (true) {
    const uid = "NEO-" + String(k).padStart(4, "0");
    const exists = await prisma.investment.findUnique({ where: { uniqueId: uid } });
    if (!exists) return uid;
    k++;
  }
}

// NB-XXXXXX — random 6 chars from CODE_CHARS, collision-checked against DB.
export async function genVerificationCode(): Promise<string> {
  while (true) {
    const code = "NB-" + Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    const exists = await prisma.investment.findUnique({ where: { verificationCode: code } });
    if (!exists) return code;
  }
}

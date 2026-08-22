import { db } from "./src/lib/db";

async function main() {
  const analyses = await db.aIAnalysis.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const a of analyses) {
    console.log(`ID: ${a.id} | Type: ${a.requestType} | FellBack: ${a.fellBack}`);
    if (a.fellBack) {
      console.log(`Reason: ${a.fallbackReason}`);
    }
    console.log("-----------------------------------------");
  }
}
main();

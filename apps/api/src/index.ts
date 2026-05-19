import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

try {
  const app = await buildApp();
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
} catch (err) {
  console.error("\n*** API START FAILED ***\n");
  console.error(err);
  console.error("\nFix: apps\\api folder mein run karo:");
  console.error("  npx prisma generate");
  console.error("  npx prisma db push");
  console.error("  npm run db:seed\n");
  process.exit(1);
}

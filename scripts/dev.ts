import { mkdirSync, existsSync } from "node:fs";
import { $ } from "bun";

// 1. Ensure data directory exists
if (!existsSync("./data")) {
  mkdirSync("./data", { recursive: true });
  console.log("Created data/ directory");
}

// 2. Run DB migrations
console.log("Running database migrations...");
await $`bun run scripts/migrate.ts`;

// 3. Seed if empty
console.log("Checking seed data...");
await $`bun run scripts/seed.ts`;

// 4. Start the Bun server and Vite dev server
console.log("\nStarting development servers...\n");

const server = Bun.spawn(["bun", "--hot", "src/server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

const vite = Bun.spawn(["bunx", "vite", "--config", "vite.config.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

// Graceful shutdown
function cleanup() {
  server.kill();
  vite.kill();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Wait for both to exit
await Promise.all([server.exited, vite.exited]);

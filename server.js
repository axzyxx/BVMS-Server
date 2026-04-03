// Render default start command often runs `node server.js` at repo root.
// This launcher starts the actual backend located in `auth-backend/server.js`.
const { spawn } = require("child_process");

const child = spawn(process.execPath, ["auth-backend/server.js"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));


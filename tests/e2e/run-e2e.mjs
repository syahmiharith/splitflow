import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const port = process.env.SPLITFLOW_E2E_PORT || "3107";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const stateFile = process.env.SPLITFLOW_STATE_FILE || path.resolve(".splitflow", `e2e-server-state-${port}.json`);

function waitForServer(url, timeoutMs = 120_000) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 500);
      });
    };

    check();
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function killTree(pid) {
  if (!pid) return;

  if (isWindows) {
    await run("taskkill.exe", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    process.kill(pid, "SIGTERM");
  }
}

await mkdir(path.dirname(stateFile), { recursive: true });
await rm(stateFile, { force: true });

const server = spawn("node", ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], {
  stdio: "inherit",
  detached: !isWindows,
  env: { ...process.env, SPLITFLOW_STATE_FILE: stateFile }
});

let exitCode = 1;
try {
  await waitForServer(baseURL);
  const command = isWindows ? "cmd.exe" : "pnpm";
  const args = isWindows ? ["/c", "pnpm", "exec", "playwright", "test"] : ["exec", "playwright", "test"];
  exitCode = await run(command, args, {
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, SPLITFLOW_STATE_FILE: stateFile }
  });
} finally {
  await killTree(server.pid);
}

process.exit(exitCode);

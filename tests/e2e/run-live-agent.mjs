import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const port = process.env.SPLITFLOW_LIVE_AGENT_PORT || "3118";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const shouldStartServer = !process.env.PLAYWRIGHT_BASE_URL;
const stateFile = process.env.SPLITFLOW_STATE_FILE || path.resolve(".splitflow", `live-agent-state-${port}.json`);

process.env.RUN_LIVE_AGENT_TESTS = process.env.RUN_LIVE_AGENT_TESTS || "1";
process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK = process.env.SPLITFLOW_USE_OPENAI_AGENTS_SDK || "1";

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

const env = {
  ...process.env,
  PLAYWRIGHT_BASE_URL: baseURL,
  SPLITFLOW_STATE_FILE: stateFile,
  RUN_LIVE_AGENT_TESTS: "1",
  SPLITFLOW_USE_OPENAI_AGENTS_SDK: "1"
};

const server = shouldStartServer
  ? spawn("node", ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", port], {
      stdio: "inherit",
      detached: !isWindows,
      env
    })
  : undefined;

let exitCode = 1;
try {
  if (shouldStartServer) {
    await waitForServer(baseURL);
  }
  const command = isWindows ? "cmd.exe" : "node_modules/.bin/playwright";
  const args = isWindows
    ? ["/c", "node_modules\\.bin\\playwright.cmd", "test", "agent-live.spec.ts"]
    : ["test", "agent-live.spec.ts"];
  exitCode = await run(command, args, { env });
} finally {
  await killTree(server?.pid);
}

process.exit(exitCode);

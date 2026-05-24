import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const port = process.env.SPLITFLOW_E2E_PORT || String(await findAvailablePort());
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const stateFile = process.env.SPLITFLOW_STATE_FILE || path.resolve(".splitflow", `e2e-server-state-${port}.json`);
const distDir = process.env.SPLITFLOW_NEXT_DIST_DIR || ".next-e2e";
const typegenFiles = ["next-env.d.ts", "tsconfig.json"];

function findAvailablePort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) {
          resolve(address.port);
          return;
        }
        reject(new Error("Could not allocate an e2e port."));
      });
    });
  });
}

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

function waitForServerProcess(server) {
  return new Promise((_, reject) => {
    server.once("exit", (code, signal) => {
      reject(new Error(`Next server exited before startup. code=${code ?? "null"} signal=${signal ?? "null"}`));
    });
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

async function snapshotTypegenFiles() {
  return Promise.all(
    typegenFiles.map(async (filePath) => ({
      filePath,
      contents: await readFile(filePath, "utf8").catch(() => undefined)
    }))
  );
}

async function restoreTypegenFiles(snapshots) {
  await Promise.all(
    snapshots.map(async ({ filePath, contents }) => {
      if (contents === undefined) return;
      await writeFile(filePath, contents);
    })
  );
}

const typegenSnapshots = await snapshotTypegenFiles();

await mkdir(path.dirname(stateFile), { recursive: true });
await rm(stateFile, { force: true });
await rm(path.resolve(distDir), { recursive: true, force: true });

let exitCode = 1;
let server;
try {
  const buildCode = await run("node", ["node_modules/next/dist/bin/next", "build"], {
    env: { ...process.env, SPLITFLOW_STATE_FILE: stateFile, SPLITFLOW_NEXT_DIST_DIR: distDir }
  });

  if (buildCode !== 0) {
    exitCode = buildCode;
  } else {
    server = spawn("node", ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
      stdio: "inherit",
      detached: !isWindows,
      env: { ...process.env, SPLITFLOW_STATE_FILE: stateFile, SPLITFLOW_NEXT_DIST_DIR: distDir }
    });

    await Promise.race([waitForServer(baseURL), waitForServerProcess(server)]);
    const command = isWindows ? "cmd.exe" : "pnpm";
    const playwrightArgs = ["exec", "playwright", "test"];
    if (isWindows) {
      playwrightArgs.push("--workers=1");
    }
    const args = isWindows ? ["/c", "pnpm", ...playwrightArgs] : playwrightArgs;
    exitCode = await run(command, args, {
      env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, SPLITFLOW_STATE_FILE: stateFile, SPLITFLOW_NEXT_DIST_DIR: distDir }
    });
  }
} finally {
  await killTree(server?.pid);
  await restoreTypegenFiles(typegenSnapshots);
}

process.exit(exitCode);

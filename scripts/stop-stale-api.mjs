import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..").toLowerCase();
const currentPid = String(process.pid);

if (process.platform !== "win32") {
  process.exit(0);
}

const output = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Depth 3",
  ],
  { encoding: "utf8" },
);

const processes = output.trim() ? JSON.parse(output) : [];
const entries = Array.isArray(processes) ? processes : [processes];

for (const entry of entries) {
  const pid = String(entry.ProcessId ?? "");
  const commandLine = String(entry.CommandLine ?? "");
  const normalizedCommand = commandLine.toLowerCase().replaceAll("/", "\\");
  const isThisWorkspace = normalizedCommand.includes(workspaceRoot);
  const isApiMain = normalizedCommand.includes("src\\main.ts");

  if (!pid || pid === currentPid || !isThisWorkspace || !isApiMain) {
    continue;
  }

  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", `Stop-Process -Id ${pid} -Force`], {
      stdio: "ignore",
    });
    console.log(`[dev] Stopped stale API process ${pid}`);
  } catch {
    // Process may already be exiting after the watch supervisor was stopped.
  }
}

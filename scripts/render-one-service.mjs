import { createServer, request as createHttpRequest } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const publicPort = Number.parseInt(process.env.PORT ?? "10000", 10);
const apiPort = Number.parseInt(process.env.INTERNAL_API_PORT ?? "4100", 10);
const webPort = Number.parseInt(process.env.INTERNAL_WEB_PORT ?? "4101", 10);
const rendererPort = Number.parseInt(process.env.INTERNAL_RENDERER_PORT ?? "4102", 10);
const webDirectory = resolveNextBuildDirectory("web", join(rootDirectory, "apps", "web"));
const rendererDirectory = resolveNextBuildDirectory("renderer", join(rootDirectory, "apps", "renderer"));

const nextBin = require.resolve("next/dist/bin/next", {
  paths: [join(rootDirectory, "apps", "web")],
});

const children = [
  startProcess("api", process.execPath, [join(rootDirectory, "apps", "api", "dist", "main.js")], {
    PORT: String(apiPort),
  }),
  startProcess("web", process.execPath, [nextBin, "start", "-p", String(webPort)], {
    PORT: String(webPort),
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api",
  }, webDirectory),
  startProcess("renderer", process.execPath, [nextBin, "start", "-p", String(rendererPort)], {
    PORT: String(rendererPort),
  }, rendererDirectory),
];

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (requestUrl.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    requestUrl.pathname = requestUrl.pathname.replace(/^\/api/, "") || "/";
    proxyRequest(request, response, apiPort, requestUrl);
    return;
  }

  if (requestUrl.pathname === "/site" || requestUrl.pathname.startsWith("/site/")) {
    requestUrl.pathname = requestUrl.pathname.replace(/^\/site/, "") || "/";
    proxyRequest(request, response, rendererPort, requestUrl);
    return;
  }

  proxyRequest(request, response, webPort, requestUrl);
});

server.listen(publicPort, () => {
  console.log(`[render] one-service proxy listening on port ${publicPort}`);
  console.log(`[render] admin web: /`);
  console.log(`[render] api: /api`);
  console.log(`[render] renderer: /site`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close();
    for (const child of children) {
      child.kill(signal);
    }
  });
}

function startProcess(name, command, args, env, cwd = rootDirectory) {
  console.log(`[render] starting ${name} in ${cwd}`);
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => process.stdout.write(prefixLines(name, data)));
  child.stderr.on("data", (data) => process.stderr.write(prefixLines(name, data)));
  child.on("exit", (code, signal) => {
    console.error(`[${name}] exited with ${signal ?? code}`);
    process.exitCode = 1;
    server.close();
    for (const sibling of children) {
      if (sibling !== child) {
        sibling.kill("SIGTERM");
      }
    }
  });

  return child;
}

function resolveNextBuildDirectory(name, appDirectory) {
  if (existsSync(join(appDirectory, ".next", "BUILD_ID"))) {
    return appDirectory;
  }

  const rootBuildId = join(rootDirectory, ".next", "BUILD_ID");
  if (existsSync(rootBuildId)) {
    console.warn(`[render] ${name} build was found at repo root. Check Render Root Directory/Build Command.`);
    return rootDirectory;
  }

  console.warn(`[render] ${name} build not found at ${join(appDirectory, ".next", "BUILD_ID")}`);
  return appDirectory;
}

function proxyRequest(incomingRequest, outgoingResponse, targetPort, requestUrl) {
  const proxy = createProxyRequest(targetPort, incomingRequest, requestUrl, (proxyResponse) => {
    outgoingResponse.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
    proxyResponse.pipe(outgoingResponse);
  });

  proxy.on("error", (error) => {
    outgoingResponse.writeHead(502, { "content-type": "application/json" });
    outgoingResponse.end(JSON.stringify({ message: `Upstream service unavailable: ${error.message}` }));
  });

  incomingRequest.pipe(proxy);
}

function createProxyRequest(targetPort, incomingRequest, requestUrl, onResponse) {
  return createHttpRequest(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      method: incomingRequest.method,
      headers: {
        ...incomingRequest.headers,
        host: `127.0.0.1:${targetPort}`,
      },
    },
    onResponse,
  );
}

function prefixLines(name, data) {
  return String(data)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `[${name}] ${line}\n`)
    .join("");
}

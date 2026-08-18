const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const fallbackApiBaseUrls = [
  "http://localhost:4000",
  "http://localhost:4001",
  "http://localhost:4002",
  "http://localhost:4003",
  "http://localhost:4004",
  "http://localhost:4005",
];
const apiBaseUrls = configuredApiBaseUrl ? [configuredApiBaseUrl] : fallbackApiBaseUrls;

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let lastNetworkError: Error | null = null;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  for (const apiBaseUrl of apiBaseUrls) {
    let response: Response;
    const requestInit: RequestInit = {
      ...init,
      credentials: "include",
      ...(isFormData
        ? init?.headers
          ? { headers: init.headers }
          : {}
        : {
            headers: {
              "Content-Type": "application/json",
              ...init?.headers,
            },
          }),
    };

    try {
      response = await fetch(`${apiBaseUrl}${path}`, requestInit);
    } catch {
      lastNetworkError = new Error(`API is unavailable at ${apiBaseUrl}`);
      continue;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "Request failed");
    }

    return response.json() as Promise<T>;
  }

  throw new Error(
    `${lastNetworkError?.message ?? "API is unavailable"}. Start the NestJS API and check .env.`,
  );
}

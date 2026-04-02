function readRequiredEnv(name: "VITE_COLLAB_WS_URL" | "VITE_LEETCODE_SERVICE_URL" | "VITE_SUBMISSIONS_SERVICE_URL"): string {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const COLLAB_WS_URL = readRequiredEnv("VITE_COLLAB_WS_URL");
export const LEETCODE_SERVICE_URL = stripTrailingSlash(
  readRequiredEnv("VITE_LEETCODE_SERVICE_URL"),
);
export const SUBMISSIONS_SERVICE_URL = stripTrailingSlash(
  readRequiredEnv("VITE_SUBMISSIONS_SERVICE_URL"),
);


import { createRequestTracker, formatHttpErrorMessage } from "./utils/asyncRuntime";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";
const requestTracker = createRequestTracker();

export function getStoredToken(): string | null {
  return localStorage.getItem("omniscient_jwt_token");
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem("omniscient_jwt_token", token);
  } else {
    localStorage.removeItem("omniscient_jwt_token");
  }
}

export function getActiveRequestsCount(): number {
  return requestTracker.activeCount();
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  requestTracker.enter();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    // Read body text ONCE so it never throws "body stream already read"
    const rawText = await res.text();
    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      throw new Error(formatHttpErrorMessage(res.status, parsed?.detail || rawText));
    }

    return (parsed !== null ? parsed : rawText) as T;
  } finally {
    requestTracker.leave();
  }
}

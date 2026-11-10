export async function postJson<T = Record<string, unknown>>(url: string, body?: unknown): Promise<T> {
  return send<T>(url, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
}

export async function postForm<T = Record<string, unknown>>(url: string, form: FormData): Promise<T> {
  return send<T>(url, { body: form });
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", ...init });
  } catch {
    throw new Error("Нет соединения с сервером");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Не удалось выполнить действие");
  return data as T;
}

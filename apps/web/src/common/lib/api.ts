export type UserRole = "ADMIN" | "USER";
export type UserStatus = "PENDING" | "APPROVED" | "REJECTED";

export type User = {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export const API_ORIGIN = API_BASE_URL.startsWith("/")
  ? ""
  : API_BASE_URL.replace(/\/api\/?$/, "");

type RequestOptions = {
  accessToken?: string | null;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  method = "GET",
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }

    return body.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
export type CommunityImageUpload = {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
};

export async function uploadCommunityImage(
  file: File,
  accessToken: string,
): Promise<CommunityImageUpload> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/community/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json() as Promise<CommunityImageUpload>;
}

export async function deleteCommunityImage(
  id: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/community/images/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
      keepalive: true,
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(await readErrorMessage(response));
  }
}

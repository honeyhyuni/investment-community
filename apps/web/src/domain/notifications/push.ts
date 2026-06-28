import { apiRequest } from "@/common/lib/api";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function enablePush(accessToken: string): Promise<void> {
  if (!pushSupported()) {
    throw new Error("이 기기 또는 브라우저는 Push 알림을 지원하지 않습니다.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다.");
  }
  const config = await apiRequest<{
    publicKey: string | null;
    enabled: boolean;
  }>("/notifications/vapid-public-key");
  if (!config.publicKey || !config.enabled) {
    throw new Error("서버 Push 알림이 아직 활성화되지 않았습니다.");
  }
  const registration = await navigator.serviceWorker.ready;
  const current = await registration.pushManager.getSubscription();
  const subscription =
    current ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.publicKey),
    }));
  await apiRequest<{ ok: true }>("/notifications/subscriptions", "POST", {
    accessToken,
    body: subscription.toJSON(),
  });
}

export async function disablePush(accessToken: string): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await apiRequest<{ ok: true }>("/notifications/subscriptions", "DELETE", {
    accessToken,
    body: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
}

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

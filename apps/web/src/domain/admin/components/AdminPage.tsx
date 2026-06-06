"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { useSessionStore } from "@/common/stores/session";
import { apiRequest, User, UserStatus } from "@/lib/api";

export function AdminPage() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN";

  const loadPendingUsers = useCallback(async (token = accessToken) => {
    if (!token) {
      return;
    }

    try {
      const users = await apiRequest<User[]>("/users/pending", "GET", {
        accessToken: token,
      });
      setPendingUsers(users);
    } catch (pendingError) {
      setError(
        pendingError instanceof Error
          ? pendingError.message
          : "Could not load pending users.",
      );
    }
  }, [accessToken]);

  // 셸(레이아웃)이 APPROVED를 보장. 여기선 관리자 권한만 추가로 가드.
  useEffect(() => {
    if (!isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, router]);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      queueMicrotask(() => setPendingUsers([]));
      return;
    }
    queueMicrotask(() => {
      loadPendingUsers(accessToken);
    });
  }, [accessToken, isAdmin, loadPendingUsers]);

  async function updateUserStatus(id: string, status: UserStatus) {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest<User>(`/users/${id}/status`, "PATCH", {
        accessToken,
        body: { status },
      });
      await loadPendingUsers(accessToken);
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Could not update user status.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      {error ? <Notice message="" error={error} /> : null}

      <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[1fr]">
        <AdminPanel
          pendingUsers={pendingUsers}
          loading={loading}
          updateUserStatus={updateUserStatus}
        />
      </div>
    </>
  );
}

function AdminPanel({
  pendingUsers,
  loading,
  updateUserStatus,
}: {
  pendingUsers: User[];
  loading: boolean;
  updateUserStatus: (id: string, status: UserStatus) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-[#d9dee8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Access approvals</h2>
        <span className="rounded-md bg-[#eef3f8] px-2.5 py-1 text-xs font-semibold text-[#344052]">
          {pendingUsers.length}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-[#d9dee8]">
        {pendingUsers.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#607086]">
            No pending accounts.
          </div>
        ) : (
          pendingUsers.map((pendingUser) => (
            <div
              key={pendingUser.id}
              className="flex flex-col gap-3 border-b border-[#eef1f6] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{pendingUser.nickname}</p>
                <p className="text-sm text-[#607086]">{pendingUser.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={loading}
                  onClick={() => updateUserStatus(pendingUser.id, "APPROVED")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2e7d4f] px-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Check size={15} />
                  Approve
                </button>
                <button
                  disabled={loading}
                  onClick={() => updateUserStatus(pendingUser.id, "REJECTED")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d3a1a1] bg-white px-3 text-sm font-semibold text-[#9a2f2f] disabled:opacity-60"
                >
                  <X size={15} />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

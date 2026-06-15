"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Notice } from "@/common/components/Notice";
import { Button } from "@/common/components/Button";
import { SectionHeader } from "@/common/components/SectionHeader";
import { Skeleton } from "@/common/components/Skeleton";
import { useSessionStore } from "@/common/stores/session";
import { usePreferencesStore } from "@/common/stores/preferences";
import { apiRequest, User, UserStatus } from "@/common/lib/api";

export function AdminPage() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const user = useSessionStore((s) => s.user);
  const ko = usePreferencesStore((s) => s.language) === "ko";

  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN";

  const loadPendingUsers = useCallback(async (token = accessToken) => {
    if (!token) {
      return;
    }

    setListLoading(true);
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
    } finally {
      setListLoading(false);
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
      queueMicrotask(() => {
        setPendingUsers([]);
        setListLoading(false);
      });
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
          listLoading={listLoading}
          updateUserStatus={updateUserStatus}
          ko={ko}
        />
      </div>
    </>
  );
}

function AdminPanel({
  pendingUsers,
  loading,
  listLoading,
  updateUserStatus,
  ko,
}: {
  pendingUsers: User[];
  loading: boolean;
  listLoading: boolean;
  updateUserStatus: (id: string, status: UserStatus) => Promise<void>;
  ko: boolean;
}) {
  return (
    <section className="-mx-4 border-y border-border bg-surface p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
      <SectionHeader
        eyebrow={ko ? "사용자 관리" : "User management"}
        title={ko ? "가입 승인" : "Access approvals"}
        action={
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {pendingUsers.length}
          </span>
        }
      />
      <div className="mt-4 overflow-hidden rounded-md border border-border">
        {listLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <AdminRowSkeleton key={index} />
          ))
        ) : pendingUsers.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            {ko ? "대기 중인 계정이 없습니다." : "No pending accounts."}
          </div>
        ) : (
          pendingUsers.map((pendingUser) => (
            <div
              key={pendingUser.id}
              className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {pendingUser.nickname}
                </p>
                <p className="truncate text-sm text-muted">{pendingUser.email}</p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3">
                <span className="whitespace-nowrap text-xs text-muted">
                  {ko ? "요청일 " : "Requested "}
                  {new Date(pendingUser.createdAt).toLocaleDateString(
                    ko ? "ko-KR" : "en-US",
                    { year: "numeric", month: "short", day: "numeric" },
                  )}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Check />}
                    disabled={loading}
                    onClick={() => updateUserStatus(pendingUser.id, "APPROVED")}
                  >
                    {ko ? "승인" : "Approve"}
                  </Button>
                  <Button
                    variant="soft-danger"
                    size="sm"
                    leftIcon={<X />}
                    disabled={loading}
                    onClick={() => updateUserStatus(pendingUser.id, "REJECTED")}
                  >
                    {ko ? "거부" : "Reject"}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// 실제 행(닉네임+이메일 / 승인·거부 버튼)과 같은 레이아웃의 로딩 스켈레톤.
function AdminRowSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20 sm:h-9" />
          <Skeleton className="h-10 w-20 sm:h-9" />
        </div>
      </div>
    </div>
  );
}

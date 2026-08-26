"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Landmark,
  LineChart,
  MessagesSquare,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { SessionLoading } from "@/common/components/SessionLoading";
import {
  DEMO_LOGIN_EMAIL,
  DEMO_LOGIN_PASSWORD,
} from "@/common/lib/demo-user";
import { useSessionStore } from "@/common/stores/session";
import { AuthPanel } from "@/domain/auth/components/AuthPanel";
import { AuthMode } from "@/domain/auth/types";

const REMEMBER_EMAIL_KEY = "rememberedEmail";

const FEATURES = [
  {
    id: "market",
    title: "마켓",
    description: "경제지표, 공모주, 실적 캘린더, AI 시황 리포트",
    icon: LineChart,
    items: [
      "경제지표: FRED 데이터를 매주 영업일 오전 7시 15분 자동 수집",
      "일일 리포트: 한국 시황은 영업일 오후 4시, 미국 시황은 오전 8시 30분 자동 업로드",
      "공모주 캘린더: DART 공시를 매일 새벽 3시에 수집해 공모가/청약일/상장일 반영",
      "실적 캘린더: 미국 기업 실적 일정을 확인하고 관심 종목 기준으로 필터링",
    ],
    previewImages: [
      {
        src: "/previews/market-economic-indicators-1.png",
        alt: "15F 경제지표 화면",
        label: "경제 지표",
        comment:
          "FRED 데이터를 매주 영업일 오전 7시 15분 자동 수집하고, CPI·PCE·고용·GDP·금리 지표를 차트로 확인할 수 있습니다.",
      },
      {
        src: "/previews/market-economic-indicators-2.png",
        alt: "15F 경제지표 상세 화면",
        label: "경제 지표",
        comment:
          "기간 선택, 원본 값, 전월 대비, 전년 대비 변환 데이터를 함께 조회해 지표 흐름을 비교할 수 있습니다.",
      },
      {
        src: "/previews/market-daily-report-kr.png",
        alt: "15F 시황 자동 리포트 화면",
        label: "시황 자동 리포트",
        comment:
          "시장 뉴스와 주요 지표를 외부 Open API로 수집하고 OpenAI API를 사용해 시황 요약문을 자동 생성합니다.",
      },
      {
        src: "/previews/market-daily-report-us.png",
        alt: "15F 시황 자동 리포트 화면",
        label: "시황 자동 리포트",
        comment:
          "영업일 기준 한국 시황은 오후 4시, 미국 시황은 오전 8시 30분에 자동 업로드됩니다.",
      },
      {
        src: "/previews/market-ipo-calendar-1.png",
        alt: "15F 공모주 캘린더 화면",
        label: "공모주 캘린더",
        comment:
          "DART 공시 데이터를 매일 새벽 3시에 자동 수집해 공모가, 청약일, 상장일을 최신 상태로 반영합니다.",
      },
      {
        src: "/previews/market-ipo-calendar-2.png",
        alt: "15F 공모주 캘린더 상세 화면",
        label: "공모주 캘린더",
        comment:
          "수집된 공모주 일정을 리스트와 캘린더 형태로 제공해 청약 일정과 상장 일정을 빠르게 확인할 수 있습니다.",
      },
      {
        src: "/previews/market-earnings-calendar-1.png",
        alt: "15F 실적 캘린더 화면",
        label: "실적 캘린더",
        comment:
          "미국 기업 실적 발표 일정을 제공하고, 관심 종목 기준으로 필요한 일정만 필터링할 수 있습니다.",
      },
    ],
  },
  {
    id: "stocks",
    title: "종목",
    description: "국내/미국 종목 검색, 차트, 기업 정보, 재무 지표",
    icon: Search,
    items: [
      "미국/한국 종목명, 티커, 종목코드 검색",
      "현재가, 등락률, 캔들 차트, 거래소/상장일/산업 정보 확인",
      "DART와 외부 금융 API 기반 기업 정보 및 재무 지표 제공",
      "선택 종목 관련 뉴스와 피드 글을 한 화면에서 연결",
    ],
    previewImages: [
      {
        src: "/previews/stock-detail-1.png",
        alt: "15F 종목 상세 화면",
        label: "종목 상세",
        comment:
          "종목명과 티커를 검색해 현재가, 등락률, 거래소, 상장일, 산업 정보를 한 화면에서 확인할 수 있습니다. 종목과 관련된 뉴스, 피드 조회 할수 있습니다.",
      },
      {
        src: "/previews/stock-detail-kr-1.png",
        alt: "15F 한국 종목 상세 화면",
        label: "종목 상세",
        comment:
          "한국 종목도 종목명과 종목코드로 검색해 현재가, 등락률, 기업 정보, 관련 뉴스와 피드를 함께 조회할 수 있습니다.",
      },
      {
        src: "/previews/stock-detail-2.png",
        alt: "15F 종목 차트 화면",
        label: "종목 벨류에이션",
        comment: "기업의 PER/PBR/EPS 같은 정보를 제공합니다.",
      },
      {
        src: "/previews/stock-detail-3.png",
        alt: "15F 종목 기업 정보 화면",
        label: "기업 재무제표",
        comment:
          "DART와 외부 금융 API를 기반으로 기업 개요, 주요 재무 지표, 관련 정보를 연결해 제공합니다. S&P500, Kospi200만 제공합니다.",
      },
      {
        src: "/previews/stock-earnings-1.png",
        alt: "15F 종목 실적 화면",
        label: "종목 실적",
        comment:
          "선택한 종목의 실적 발표 일정과 실적 데이터를 별도 화면에서 확인할 수 있습니다.",
      },
    ],
  },
  {
    id: "my",
    title: "My",
    description: "관심 종목, 포트폴리오, 보유 비중과 성과 확인",
    icon: BriefcaseBusiness,
    items: [
      "관심 종목 저장 및 목록 관리",
      "포트폴리오 생성/수정/삭제와 보유 종목·수량 입력",
      "현재가와 환율을 반영한 평가 금액, 손익, 비중 확인",
      "관심 종목·포트폴리오 기반 실적 일정 필터링",
    ],
    previewImages: [
      {
        src: "/previews/my-watchlist-3.png",
        alt: "15F 내 관심종목 및 알람 화면",
        label: "내 관심종목",
        comment:
          "관심 있게 보는 종목을 저장하고 현재가와 등락률을 한 화면에서 확인할 수 있으며, 관심종목의 5단위 등락률 알람 기능을 제공합니다.",
      },
      {
        src: "/previews/my-portfolio-benchmark-1.png",
        alt: "15F 포트폴리오 벤치마킹 화면",
        label: "포트폴리오 벤치마킹",
        comment:
          "주요 지수 및 종목과 내 포트폴리오의 수익률을 비교할 수 있습니다.",
      },
      {
        src: "/previews/my-portfolio-accounts-1.png",
        alt: "15F 포트폴리오 계좌 화면",
        label: "포트폴리오 관리",
        comment:
          "여러 계좌를 등록해 보유 종목, 평가 금액, 손익, 비중을 한눈에 확인할 수 있습니다.",
      },
    ],
  },
  {
    id: "feed",
    title: "피드",
    description: "종목 태그 기반 투자 커뮤니티와 공개/비공개 게시글",
    icon: MessagesSquare,
    items: [
      "TipTap 기반 리치 텍스트 게시글 작성과 이미지 업로드",
      "종목 태그를 연결해 관련 종목 페이지와 피드 연결",
      "댓글, 대댓글, 좋아요, 북마크, 사용자 구독",
      "작성자가 게시글을 공개/비공개로 관리하고 서버에서 접근 제어",
    ],
    previewImages: [
      {
        src: "/previews/feed-community-1.png",
        alt: "15F 피드 화면",
        label: "투자 커뮤니티 피드",
        comment:
          "종목 태그를 연결해 관련 종목 페이지와 피드를 연결하고, 댓글, 대댓글, 좋아요, 북마크, 사용자 구독 기능을 제공합니다.",
      },
      {
        src: "/previews/feed-editor-1.png",
        alt: "15F 피드 글 작성 화면",
        label: "피드 글 작성",
        comment:
          "마크업 언어로 글을 작성할 수 있으며, 이미지 업로드와 다양한 편집 기능을 제공합니다.",
      },
    ],
  },
  {
    id: "masters",
    title: "거장",
    description: "13F 기반 대형 투자자 포트폴리오 분석",
    icon: Landmark,
    items: [
      "13F 공시 기반 주요 투자자 포트폴리오 조회",
      "투자자별 보유 종목, 비중, 평가 금액, 보유 주식 수 확인",
      "여러 거장의 공통 보유·매수·매도 종목 집계",
      "보유 종목 검색, 정렬, 포트폴리오 맵 시각화",
    ],
    previewImages: [
      {
        src: "/previews/guru-list-v2.png",
        alt: "15F 거장 포트폴리오 목록 화면",
        label: "거장 포트폴리오 목록",
        comment:
          "13F 공시 기반 주요 투자자의 포트폴리오를 모아 보고, 보유 규모와 대표 보유 종목을 빠르게 확인할 수 있습니다.",
      },
      {
        src: "/previews/guru-summary-v2-1.png",
        alt: "15F 거장 상세 요약 화면",
        label: "거장 상세 요약",
        comment:
          "투자자별 포트폴리오 규모, 보유종목 수, Top 10 비중, 추정 회전율을 요약 지표로 제공합니다.",
      },
      {
        src: "/previews/guru-summary-v2-2.png",
        alt: "15F 거장 분기 매매 화면",
        label: "분기 매매 내역",
        comment:
          "전분기 대비 신규매수, 비중확대, 비중축소, 청산매도를 구분해 최근 포트폴리오 변화 방향을 확인할 수 있습니다.",
      },
      {
        src: "/previews/guru-summary-v2-3.png",
        alt: "15F 거장 보유종목 Top 10 화면",
        label: "보유종목 Top 10",
        comment:
          "요약 탭에서도 현재 비중이 높은 보유종목 Top 10을 확인하고, 전체 종목 탭에서 상세 필터와 정렬을 사용할 수 있습니다.",
      },
    ],
  },
] as const;

type Feature = (typeof FEATURES)[number];
type FeatureId = Feature["id"];

export default function LoginPage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const authChecking = useSessionStore((s) => s.authChecking);
  const login = useSessionStore((s) => s.login);
  const register = useSessionStore((s) => s.register);

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.status === "APPROVED") {
      router.replace("/");
    }
  }, [user?.status, router]);

  useEffect(() => {
    queueMicrotask(() => {
      const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRememberEmail(true);
      }
    });
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const { user: registered } = await register(email, password, nickname);
        setMessage(
          registered.status === "APPROVED"
            ? "관리자 계정이 생성되었습니다. 로그인할 수 있습니다."
            : "가입 요청이 접수되었습니다. 관리자 승인 후 이용할 수 있습니다.",
        );
        setMode("login");
        return;
      }

      await login(email, password);
      if (rememberEmail) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      setMessage("");
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "요청을 처리하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (authChecking || user?.status === "APPROVED") {
    return <SessionLoading />;
  }

  const heading = mode === "login" ? "로그인" : "가입 요청";

  return (
    <div className="grid flex-1 items-center gap-8 py-4 sm:py-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
      <LoginIntro />
      <AuthPanel
        mode={mode}
        setMode={setMode}
        email={email}
        setEmail={setEmail}
        rememberEmail={rememberEmail}
        setRememberEmail={setRememberEmail}
        password={password}
        setPassword={setPassword}
        nickname={nickname}
        setNickname={setNickname}
        heading={heading}
        user={user}
        message={message}
        error={error}
        loading={loading}
        submitAuth={submitAuth}
      />
    </div>
  );
}

function LoginIntro() {
  const [modalFeatureId, setModalFeatureId] = useState<FeatureId | null>(null);
  const modalFeature =
    FEATURES.find((feature) => feature.id === modalFeatureId) ?? null;

  return (
    <section className="w-full max-w-3xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary shadow-sm">
        <Sparkles className="size-3.5" />
        15F Investment Platform
      </div>

      <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        시장 흐름을 읽고, 종목을 분석하고, 투자 아이디어를 공유합니다.
      </h1>

      <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
        15F는 경제지표, 실적/공모주 캘린더, AI 시황 리포트, 종목 상세
        정보, 투자자 커뮤니티와 13F 거장 포트폴리오를 하나로 연결한 투자
        정보 플랫폼입니다.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;

          return (
            <button
              key={feature.id}
              type="button"
              onClick={() => setModalFeatureId(feature.id)}
              className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3.5 text-left shadow-sm transition hover:border-primary/60 hover:bg-primary/5 hover:shadow-md"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-foreground">
                  {feature.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted">
                  {feature.description}
                </span>
                <span className="mt-2 block text-sm font-semibold text-primary">
                  자세히 보기
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3 text-sm text-muted">
        <span className="font-semibold text-foreground">테스트 계정</span>{" "}
        {DEMO_LOGIN_EMAIL} / {DEMO_LOGIN_PASSWORD}
        <p className="mt-1 text-xs leading-5">
          테스트 계정은 포트폴리오 확인용이며, 피드에서는 읽기 전용으로
          동작합니다.
        </p>
      </div>

      {modalFeature ? (
        <FeatureModal
          feature={modalFeature}
          onClose={() => setModalFeatureId(null)}
        />
      ) : null}
    </section>
  );
}

function FeatureModal({
  feature,
  onClose,
}: {
  feature: Feature;
  onClose: () => void;
}) {
  const Icon = feature.icon;
  const hasPreviewImages = feature.previewImages.length > 0;

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-modal-title"
        className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase text-primary">
                15F 주요 기능
              </p>
              <h2
                id="feature-modal-title"
                className="mt-1 text-3xl font-semibold text-foreground"
              >
                {feature.title}
              </h2>
              <p className="mt-1 text-base leading-7 text-muted">
                {feature.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/50 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {hasPreviewImages ? (
            <div className="grid gap-5">
              {feature.previewImages.map((preview) => (
                <figure
                  key={preview.src}
                  className="overflow-hidden rounded-lg border border-border bg-white shadow-sm"
                >
                  <div className="border-b border-border bg-surface px-4 py-3">
                    <p className="text-base font-semibold text-foreground">
                      {preview.label}
                    </p>
                    <p className="mt-1 text-base leading-7 text-muted">
                      {preview.comment}
                    </p>
                  </div>
                  <Image
                    src={preview.src}
                    alt={preview.alt}
                    width={1203}
                    height={770}
                    sizes="(min-width: 1024px) 1040px, 100vw"
                    className="h-auto w-full"
                    priority={feature.id === "market"}
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {feature.items.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-base leading-7 text-foreground"
                >
                  {item}
                </div>
              ))}
              <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border bg-surface-muted p-6 text-center">
                <div>
                  <p className="text-base font-semibold text-foreground">
                    화면 캡처 준비 중
                  </p>
                  <p className="mt-2 text-base leading-7 text-muted">
                    해당 메뉴 캡처를 추가하면 이 영역에 실제 화면이 크게
                    표시됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

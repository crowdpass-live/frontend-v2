import { apiFetch } from "./api";

/**
 * Spin the wheel (backend `src/spin-wheel/`): a marketing game run at an
 * in-person event. One spin per verified account per campaign; the server
 * picks the result, and the event's check-in team hands prizes over against
 * a claim code at the booth.
 */

export type SpinPrizeKind = "PHYSICAL" | "AIRTIME";
export type SpinRewardStatus = "PENDING" | "FULFILLED";
export type CampaignState = "UPCOMING" | "OPEN" | "CLOSED";

export interface SpinPrize {
  id: string;
  label: string;
  kind: SpinPrizeKind;
  airtimeAmount: number | null;
}

export interface SpinResult {
  id: string;
  prize: SpinPrize | null;
  claimCode: string | null;
  status: SpinRewardStatus | null;
  airtimePhone: string | null;
  fulfilledAt: string | null;
  createdAt: string;
}

export interface SpinCampaign {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  state: CampaignState;
  event: { id: string; name: string; slug: string; coverImage: string | null };
  prizes: SpinPrize[];
  /** Null when signed out. */
  me: { verified: boolean; spin: SpinResult | null } | null;
}

export interface PrizeClaim extends SpinResult {
  winnerName: string;
}

export interface PrizeSummary {
  title: string;
  state: CampaignState;
  startsAt: string;
  endsAt: string;
  totalSpins: number;
  prizes: (SpinPrize & {
    stock: number;
    won: number;
    handedOver: number;
    releasedNow: number;
  })[];
}

/** `ABC-123` reads across a noisy booth better than `ABC123`. */
export function formatClaimCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

// --- Player (browser) ----------------------------------------------------

export function spinOnce(campaignId: string) {
  return apiFetch<{ spin: SpinResult; alreadySpun: boolean }>(
    `/spin-wheel/${campaignId}/spin`,
    { method: "POST", auth: true },
  );
}

export function submitAirtimePhone(campaignId: string, phone: string) {
  return apiFetch<SpinResult>(`/spin-wheel/${campaignId}/airtime-phone`, {
    method: "POST",
    auth: true,
    body: { phone },
  });
}

// --- Booth staff (browser) -----------------------------------------------

export function fetchPrizeSummary(campaignId: string) {
  return apiFetch<PrizeSummary>(`/spin-wheel/${campaignId}/summary`, { auth: true });
}

export function fetchWinners(campaignId: string, kind?: SpinPrizeKind) {
  const q = kind ? `?kind=${kind}` : "";
  return apiFetch<PrizeClaim[]>(`/spin-wheel/${campaignId}/winners${q}`, { auth: true });
}

export function lookupClaim(campaignId: string, code: string) {
  return apiFetch<PrizeClaim>(
    `/spin-wheel/${campaignId}/claims/${encodeURIComponent(code)}`,
    { auth: true },
  );
}

export function fulfilClaim(campaignId: string, code: string) {
  return apiFetch<PrizeClaim>(
    `/spin-wheel/${campaignId}/claims/${encodeURIComponent(code)}/fulfil`,
    { method: "POST", auth: true },
  );
}

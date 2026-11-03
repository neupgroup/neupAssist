import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@neup/core/database/prisma";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";
import { Icon } from "@/app/ui-icon";

export const dynamic = "force-dynamic";

type UsageEntry = {
  id: string;
  callerkey_id: string;
  input_token: number;
  output_token: number;
  cost: { toString(): string };
  created_at: Date;
};

type UsageSummary = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: string;
  entries: UsageEntry[];
  error: boolean;
};

/** Loads usage records and totals for the signed-in account's caller keys. */
async function loadCallerUsage(): Promise<UsageSummary> {
  try {
    const token = await getPublicAccountToken(async (name) => (await cookies()).get(name)?.value);
    const account = await ensureAccount(token);
    if (!account) return { requests: 0, inputTokens: 0, outputTokens: 0, cost: "0", entries: [], error: false };

    const where = { callerkey: { account_id: account.id } };
    const [requests, totals, entries] = await Promise.all([
      prisma.callerUsage.count({ where }),
      prisma.callerUsage.aggregate({ where, _sum: { input_token: true, output_token: true, cost: true } }),
      prisma.callerUsage.findMany({ where, select: { id: true, callerkey_id: true, input_token: true, output_token: true, cost: true, created_at: true }, orderBy: { created_at: "desc" }, take: 100 }),
    ]);

    return {
      requests,
      inputTokens: totals._sum.input_token ?? 0,
      outputTokens: totals._sum.output_token ?? 0,
      cost: totals._sum.cost?.toString() ?? "0",
      entries,
      error: false,
    };
  } catch {
    return { requests: 0, inputTokens: 0, outputTokens: 0, cost: "0", entries: [], error: true };
  }
}

/** Formats the recorded fractional-cent value for display. */
function formatUsageCost(cost: string) {
  const value = Number(cost);
  return Number.isFinite(value) ? `¢${value.toFixed(6)}` : "—";
}

/** Shows caller API token usage and costs for the signed-in account. */
export default async function ApiUsagePage() {
  const usage = await loadCallerUsage();
  const summaries = [
    { label: "Requests", value: usage.requests.toLocaleString(), icon: "code" as const },
    { label: "Input tokens", value: usage.inputTokens.toLocaleString(), icon: "arrow" as const },
    { label: "Output tokens", value: usage.outputTokens.toLocaleString(), icon: "sparkles" as const },
    { label: "Total cost", value: formatUsageCost(usage.cost), icon: "key" as const },
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <Link href="/settings/api" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Icon name="arrowRight" className="rotate-180" size={15} /> API settings</Link>
        <div className="mb-6">
          <h1 className="m-0 text-[clamp(35px,4vw,47px)] font-medium tracking-[-.055em] text-foreground">API usage</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Token usage and recorded costs across your API keys.</p>
        </div>

        {usage.error ? <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">Could not load API usage from the database.</p> : null}

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaries.map(({ label, value, icon }) => <article key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon name={icon} size={16} />{label}</div>
            <p className="mb-0 mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          </article>)}
        </div>

        <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="api-usage-history-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="api-usage-history-title" className="m-0 text-base font-semibold text-foreground">Recent requests</h2>
            <span className="text-xs text-muted-foreground">Latest {usage.entries.length} of {usage.requests}</span>
          </div>
          {usage.entries.length ? <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-border text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground"><th className="px-3 py-3">Time</th><th className="px-3 py-3">Caller key</th><th className="px-3 py-3">Input tokens</th><th className="px-3 py-3">Output tokens</th><th className="px-3 py-3">Cost</th></tr></thead>
              <tbody>{usage.entries.map((entry) => <tr key={entry.id} className="border-b border-border align-top last:border-0">
                <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">{entry.created_at.toLocaleString()}</td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{entry.callerkey_id.slice(0, 8)}</td>
                <td className="px-3 py-3 tabular-nums text-foreground">{entry.input_token.toLocaleString()}</td>
                <td className="px-3 py-3 tabular-nums text-foreground">{entry.output_token.toLocaleString()}</td>
                <td className="px-3 py-3 tabular-nums text-foreground">{formatUsageCost(entry.cost.toString())}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="mb-0 mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No API usage has been recorded yet.</p>}
        </section>
      </div>
    </section>
  );
}

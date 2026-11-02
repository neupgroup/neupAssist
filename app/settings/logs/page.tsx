import Link from "next/link";
import { prisma } from "@neup/core/database/prisma";

export const dynamic = "force-dynamic";

type CallerLogEntry = {
  id: string;
  account_id: string | null;
  application_id: string | null;
  log: unknown;
  timestamp: Date;
  account: { displayName: string } | null;
  application: { name: string } | null;
};

/** Loads the newest caller log entries with their related account and application names. */
async function loadCallerLogs(): Promise<{ entries: CallerLogEntry[]; total: number; error: boolean }> {
  try {
    const [total, entries] = await Promise.all([
      prisma.callerLog.count(),
      prisma.callerLog.findMany({
        select: {
          id: true,
          account_id: true,
          application_id: true,
          log: true,
          timestamp: true,
          account: { select: { displayName: true } },
          application: { select: { name: true } },
        },
        orderBy: { timestamp: "desc" },
        take: 200,
      }),
    ]);
    return { entries, total, error: false };
  } catch {
    return { entries: [], total: 0, error: true };
  }
}

/** Formats structured log content for display in the logs table. */
function formatLog(log: unknown): string {
  if (typeof log === "string") return log;
  try {
    return JSON.stringify(log, null, 2);
  } catch {
    return "Log details are unavailable.";
  }
}

/** Extracts an outcome label from structured log data. */
function getLogOutcome(log: unknown): string {
  if (!log || typeof log !== "object" || !("outcome" in log)) return "—";
  const outcome = (log as { outcome?: unknown }).outcome;
  return typeof outcome === "string" ? outcome.replaceAll("_", " ") : "—";
}

/** Renders caller communication logs for inspecting app discovery and tool calls. */
export default async function ManageLogsPage() {
  const { entries, total, error } = await loadCallerLogs();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>Caller logs</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Inspect app discovery and tool call activity. Showing the latest 200 entries.</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-[18px] min-w-0" aria-labelledby="caller-logs-title">
          <div className="flex items-start justify-between [&_h2]:mt-[7px] [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-.025em] [&_h2]:text-foreground">
            <div><h2 id="caller-logs-title">Communication history</h2></div>
            <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary">{error ? "—" : entries.length}</span>
          </div>
          {error ? (
            <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground" role="status">Could not load caller logs from the database.</div>
          ) : entries.length === 0 ? (
            <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground">No app communication logs have been recorded yet.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[#edf0ec] text-xs font-semibold uppercase tracking-[.08em] text-[#89938a]">
                  <th className="px-3 py-3">Time</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Application</th><th className="px-3 py-3">Outcome</th><th className="px-3 py-3">Log details</th>
                </tr></thead>
                <tbody>{entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#f0f2ef] align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-[#69756c]">{entry.timestamp.toLocaleString()}</td>
                    <td className="px-3 py-3 text-[#69756c]"><span className="block">{entry.account?.displayName ?? "Deleted account"}</span><code className="mt-1 block max-w-[180px] overflow-hidden text-ellipsis text-xs text-[#89938a]">{entry.account_id ?? "—"}</code></td>
                    <td className="px-3 py-3 text-[#69756c]"><span className="block">{entry.application?.name ?? (entry.application_id ? "Deleted application" : "—")}</span>{entry.application_id && <code className="mt-1 block max-w-[180px] overflow-hidden text-ellipsis text-xs text-[#89938a]">{entry.application_id}</code>}</td>
                    <td className="whitespace-nowrap px-3 py-3 capitalize text-[#69756c]">{getLogOutcome(entry.log)}</td>
                    <td className="max-w-[560px] px-3 py-3"><pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#f8faf7] p-3 font-mono text-xs leading-5 text-[#58645b]">{formatLog(entry.log)}</pre></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

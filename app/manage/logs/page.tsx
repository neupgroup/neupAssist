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
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><span>Manage</span><span className="crumb-slash">/</span><strong>Logs</strong></div>
        <span className="settings-save-status">{error ? "Database unavailable" : `${total} ${total === 1 ? "entry" : "entries"}`}</span>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><span aria-hidden="true" className="text-lg">≋</span></div>
          <p className="page-eyebrow">APP COMMUNICATION</p>
          <h1>Caller logs</h1>
          <p className="page-description">Inspect app discovery and tool call activity. Showing the latest 200 entries.</p>
        </div>

        <section className="api-card saved-keys-card" aria-labelledby="caller-logs-title">
          <div className="card-title-row">
            <div><span className="card-eyebrow">LOCAL DATABASE</span><h2 id="caller-logs-title">Communication history</h2></div>
            <span className="key-count">{error ? "—" : entries.length}</span>
          </div>
          {error ? (
            <div className="keys-empty" role="status">Could not load caller logs from the database.</div>
          ) : entries.length === 0 ? (
            <div className="keys-empty">No app communication logs have been recorded yet.</div>
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

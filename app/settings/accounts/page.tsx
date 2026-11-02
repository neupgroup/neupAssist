import Link from "next/link";
import { prisma } from "@neup/core/database/prisma";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";

export const dynamic = "force-dynamic";

type AccountEntry = {
  id: string;
  displayName: string;
  type: string;
  status: string;
  neupId: string | null;
  _count: { chats: number; messages: number };
};

/** Loads account rows and their chat totals for the accounts page. */
async function loadAccounts(): Promise<{ accounts: AccountEntry[]; total: number; error: boolean }> {
  try {
    const [total, accounts] = await Promise.all([
      prisma.account.count(),
      prisma.account.findMany({
        select: {
          id: true,
          displayName: true,
          type: true,
          status: true,
          neupId: true,
          _count: { select: { chats: true, messages: true } },
        },
        orderBy: { displayName: "asc" },
      }),
    ]);
    return { total, accounts, error: false };
  } catch {
    return { total: 0, accounts: [], error: true };
  }
}

/** Shows account records currently stored in the application database. */
export default async function ManageAccountsPage() {
  try {
    const account = await ensureAccount(await getPublicAccountToken(getCookie));
    if (account) {
      await prisma.chat.updateMany({ where: { account_id: null }, data: { account_id: account.id } });
      await prisma.message.updateMany({
        where: { type: "userSent", chat: { is: { account_id: account.id } } },
        data: { sent_by: account.id },
      });
    }
  } catch { /* Continue rendering existing account data if account synchronization is unavailable. */ }
  const { accounts, total, error } = await loadAccounts();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>Manage accounts</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Review account records synchronized with NeupID and their saved chat totals.</p>
        </div>

        <section className="rounded-xl border border-border bg-card p-[18px] min-w-0" aria-labelledby="accounts-table-title">
          <div className="flex items-start justify-between [&_h2]:mt-[7px] [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-.025em] [&_h2]:text-foreground">
            <div><h2 id="accounts-table-title">Accounts</h2></div>
            <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary">{error ? "—" : total}</span>
          </div>
          {error ? (
            <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground" role="status">Could not load accounts from the database.</div>
          ) : accounts.length === 0 ? (
            <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground">No account records are stored yet.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                <thead><tr className="border-b border-[#edf0ec] text-xs font-semibold uppercase tracking-[.08em] text-[#89938a]">
                  <th className="px-3 py-3">Account</th><th className="px-3 py-3">NeupID</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Chats</th><th className="px-3 py-3 text-right">Messages</th>
                </tr></thead>
                <tbody>{accounts.map((account) => (
                  <tr key={account.id} className="border-b border-[#f0f2ef] last:border-0">
                    <td className="px-3 py-3"><strong className="block font-medium text-[#465349]">{account.displayName}</strong><code className="mt-1 block max-w-[260px] overflow-hidden text-ellipsis text-xs text-[#89938a]">{account.id}</code></td>
                    <td className="px-3 py-3 text-[#69756c]">{account.neupId || "—"}</td>
                    <td className="px-3 py-3 capitalize text-[#69756c]">{account.type}</td>
                    <td className="px-3 py-3"><span className="rounded-md bg-[#edf4ec] px-2 py-1 text-xs font-semibold text-[#5b8062]">{account.status}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#69756c]">{account._count.chats}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#69756c]">{account._count.messages}</td>
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

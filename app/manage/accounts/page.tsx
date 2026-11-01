import { prisma } from "@neup/core/database/prisma";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";

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
    const account = await ensureAccount(await getCookie("auth_account"));
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
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><span>Manage</span><span className="crumb-slash">/</span><strong>Accounts</strong></div>
        <span className="settings-save-status">{error ? "Database unavailable" : `${total} ${total === 1 ? "account" : "accounts"}`}</span>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><span aria-hidden="true" className="text-lg">◎</span></div>
          <p className="page-eyebrow">WORKSPACE DATA</p>
          <h1>Manage accounts</h1>
          <p className="page-description">Review account records synchronized with NeupID and their saved chat totals.</p>
        </div>

        <section className="api-card saved-keys-card" aria-labelledby="accounts-table-title">
          <div className="card-title-row">
            <div><span className="card-eyebrow">LOCAL DATABASE</span><h2 id="accounts-table-title">Accounts</h2></div>
            <span className="key-count">{error ? "—" : total}</span>
          </div>
          {error ? (
            <div className="keys-empty" role="status">Could not load accounts from the database.</div>
          ) : accounts.length === 0 ? (
            <div className="keys-empty">No account records are stored yet.</div>
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

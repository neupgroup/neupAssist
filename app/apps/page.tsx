import { getCookie } from "@neup/core/helpers/cookie";
import Link from "next/link";
import { ensureAccount } from "@/services/account";
import { prisma } from "@/prisma/client/server";

export const dynamic = "force-dynamic";

type AppDirectoryEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  instructions: string;
  endpoints: unknown;
  authMethod: string;
  moreDetails: string | null;
  displayImage: string | null;
  coverImage: string | null;
  _count: { integrations: number };
};

type IntegrationEntry = {
  id: number;
  status: string;
  addedOn: Date;
  application: { id: string; name: string; category: string };
};

type AppsPageData = {
  applications: AppDirectoryEntry[];
  integrations: IntegrationEntry[];
  accountAvailable: boolean;
  error: boolean;
};

/** Loads the application directory and integrations owned by the current account. */
async function loadAppsPageData(): Promise<AppsPageData> {
  try {
    const account = await ensureAccount(await getCookie("auth_account"));
    const [applications, integrations] = await Promise.all([
      prisma.application.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          instructions: true,
          endpoints: true,
          authMethod: true,
          moreDetails: true,
          displayImage: true,
          coverImage: true,
          _count: { select: { integrations: true } },
        },
        orderBy: { name: "asc" },
      }),
      account
        ? prisma.integration.findMany({
            where: { account_id: account.id },
            select: { id: true, status: true, addedOn: true, application: { select: { id: true, name: true, category: true } } },
            orderBy: { addedOn: "desc" },
          })
        : Promise.resolve([]),
    ]);
    return { applications, integrations, accountAvailable: Boolean(account), error: false };
  } catch {
    return { applications: [], integrations: [], accountAvailable: false, error: true };
  }
}

/** Renders applications and the signed-in account's active integrations. */
export default async function AppsAndIntegrationsPage() {
  const { applications, integrations, accountAvailable, error } = await loadAppsPageData();

  return (
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Apps and Integrations</strong></div>
        <span className="settings-save-status">{error ? "Database unavailable" : `${integrations.length} connected`}</span>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><span aria-hidden="true" className="text-lg">⌘</span></div>
          <p className="page-eyebrow">CONNECTED SERVICES</p>
          <h1>Apps and Integrations</h1>
          <p className="page-description">Browse supported applications and review the services connected to your account.</p>
        </div>

        {error ? (
          <div className="api-card keys-empty" role="status">Could not load apps and integrations from the database.</div>
        ) : (
          <>
            <section className="api-card saved-keys-card mb-4" aria-labelledby="integrations-title">
              <div className="card-title-row">
                <div><span className="card-eyebrow">YOUR ACCOUNT</span><h2 id="integrations-title">Integrations</h2></div>
                <span className="key-count">{integrations.length}</span>
              </div>
              {!accountAvailable ? (
                <div className="keys-empty">Sign in to view your connected integrations.</div>
              ) : integrations.length === 0 ? (
                <div className="keys-empty">No integrations are connected yet.</div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {integrations.map((integration) => (
                    <article key={integration.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#edf0ec] px-4 py-3">
                      <div><strong className="text-sm font-semibold text-[#465349]">{integration.application.name}</strong><span className="ml-2 text-xs text-[#89938a]">{integration.application.category}</span><p className="mb-0 mt-1 text-xs text-[#89938a]">Added {integration.addedOn.toLocaleDateString()}</p></div>
                      <span className="rounded-md bg-[#edf4ec] px-2 py-1 text-xs font-semibold capitalize text-[#5b8062]">{integration.status}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="api-card saved-keys-card" aria-labelledby="applications-title">
              <div className="card-title-row">
                <div><span className="card-eyebrow">AVAILABLE SERVICES</span><h2 id="applications-title">Applications</h2></div>
                <div className="flex items-center gap-3"><span className="key-count">{applications.length}</span><Link href="/apps/new" className="inline-flex h-9 items-center rounded-lg bg-[#52785e] px-3 text-sm font-medium text-white hover:bg-[#456b51]">+ Add application</Link></div>
              </div>
              {applications.length === 0 ? (
                <div className="keys-empty">No applications have been added yet.</div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {applications.map((application) => (
                    <article key={application.id} className="rounded-lg border border-[#edf0ec] p-4">
                      {application.coverImage && <img src={application.coverImage} alt="" className="mb-4 h-32 w-full rounded-md object-cover" />}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">{application.displayImage && <img src={application.displayImage} alt="" className="h-10 w-10 rounded-lg border border-[#edf0ec] object-cover" />}<div><span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#7c8c7e]">{application.category}</span><h3 className="mb-0 mt-1 text-base font-semibold text-[#3c4940]"><Link href={`/apps/${application.id}`} className="hover:text-[#52785e]">{application.name}</Link></h3></div></div>
                        <span className="text-xs text-[#89938a]">{application._count.integrations} connected</span>
                      </div>
                      <p className="mb-0 mt-2 text-sm leading-6 text-[#69756c]">{application.description}</p>
                      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div><dt className="font-semibold text-[#7c8c7e]">Authentication</dt><dd className="m-0 mt-1 text-[#69756c]">{application.authMethod}</dd></div>
                        <div><dt className="font-semibold text-[#7c8c7e]">Endpoints</dt><dd className="m-0 mt-1 break-words font-mono text-[#69756c]">{JSON.stringify(application.endpoints)}</dd></div>
                      </dl>
                      {application.instructions && <details className="mt-3 border-t border-[#f0f2ef] pt-3"><summary className="cursor-pointer text-xs font-semibold text-[#637c67]">Application instructions</summary><p className="mb-0 mt-2 whitespace-pre-wrap text-sm leading-6 text-[#69756c]">{application.instructions}</p></details>}
                      {application.moreDetails && <p className="mb-0 mt-3 border-t border-[#f0f2ef] pt-3 text-sm leading-6 text-[#69756c]">{application.moreDetails}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </section>
  );
}

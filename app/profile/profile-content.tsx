import { notFound } from "next/navigation";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";

export const dynamic = "force-dynamic";

/** Loads and displays the signed-in user's account profile. */
export async function ProfileContent() {
  const account = await ensureAccount(await getPublicAccountToken(getCookie));
  if (!account) notFound();

  const initials = account.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),900px)] pt-[56px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-10 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[34px]">
        <div className="mb-[27px]">
          
          <h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Profile</h1>
          <p className="mt-2 text-[15px] text-[#818b83]">Your profile information from NeupID.</p>
        </div>

        <section className="overflow-hidden rounded-xl border border-[#e6ebe4] bg-white" aria-labelledby="profile-card-title">
          <div className="flex items-center gap-5 border-b border-[#edf0ec] px-6 py-6 max-[600px]:gap-4 max-[600px]:px-4">
            {account.displayImage ? (
              <img src={account.displayImage} alt={`${account.displayName} profile`} className="h-28 w-28 shrink-0 rounded-full border border-[#e6ebe4] object-cover max-[600px]:h-20 max-[600px]:w-20" />
            ) : (
              <span aria-label={`${account.displayName} profile`} className="grid h-28 w-28 shrink-0 place-items-center rounded-full border border-[#e6ebe4] bg-[#edf3ec] text-3xl font-semibold text-[#66836b] max-[600px]:h-20 max-[600px]:w-20">{initials}</span>
            )}
            <div className="min-w-0">
              <h2 id="profile-card-title" className="m-0 truncate text-[21px] font-semibold tracking-[-.03em] text-[#344139]">{account.displayName}</h2>
              <p className="mt-1 text-[14px] text-[#7b877e]">{account.neupId ? `@${account.neupId}` : "NeupID profile"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 px-6 py-6 max-[600px]:grid-cols-1 max-[600px]:gap-y-5 max-[600px]:px-4">
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">Display name</dt><dd className="mt-1.5 break-words text-[14px] text-[#465349]">{account.displayName}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">NeupID</dt><dd className="mt-1.5 break-words text-[14px] text-[#465349]">{account.neupId ? `@${account.neupId}` : "Not set"}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">Account type</dt><dd className="mt-1.5 capitalize text-[14px] text-[#465349]">{account.type}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">Account status</dt><dd className="mt-1.5 capitalize text-[14px] text-[#465349]">{account.status}</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}

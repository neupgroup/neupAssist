import Link from "next/link";
import { Icon } from "../ui-icon";

const settingsPages = [
  { href: "/settings/accounts", title: "Accounts", description: "Review account records and activity totals.", icon: "settings" as const },
  { href: "/settings/keys", title: "Keys", description: "Create and manage provider credentials.", icon: "key" as const },
  { href: "/settings/api", title: "API", description: "View API access and integration guidance.", icon: "code" as const },
  { href: "/settings/applications", title: "Applications", description: "Browse and manage connected applications.", icon: "code" as const },
  { href: "/settings/personalization", title: "Personalization", description: "Choose your language and assistant response preferences.", icon: "settings" as const },
  { href: "/settings/privacy", title: "Privacy", description: "Review privacy information for this workspace.", icon: "help" as const },
  { href: "/settings/data", title: "Data", description: "Manage your saved conversation history.", icon: "chat" as const },
  { href: "/settings/logs", title: "Logs", description: "Review recent application activity and requests.", icon: "search" as const },
  { href: "/settings/profile", title: "Profile", description: "View your NeupID account details.", icon: "settings" as const },
];

/** Displays the settings destinations as a card-only index. */
export default function SettingsPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),900px)] pt-[56px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-10 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[34px]">
        <div className="mb-[27px]"><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Settings</h1><p className="mt-2 text-[15px] text-[#818b83]">Choose a settings area to manage.</p></div>
        <nav className="grid grid-cols-1 gap-3" aria-label="Settings pages">
          {settingsPages.map(({ href, title, description, icon }) => (
            <Link key={href} href={href} className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-[#e6ebe4] bg-white px-4 py-3 transition-colors hover:border-[#cbd9ca] hover:bg-[#fbfcfa]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name={icon} size={18} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-[14px] font-semibold text-[#3d4941]">{title}</strong><span className="mt-1 block text-[13px] leading-5 text-[#858f86]">{description}</span></span>
              <Icon name="arrow" size={15} className="shrink-0 text-[#9aa59a] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

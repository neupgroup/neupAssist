"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { Link } from "@neup/components/ui/link";
import { Icon } from "./ui-icon";

const navigation = [
  { href: "/chat", label: "Chat", icon: "chat" as const },
  { href: "/voice", label: "Voice assistant", icon: "voice" as const },
  { href: "/api", label: "API", icon: "code" as const },
  { href: "/manage/keys", label: "Manage keys", icon: "key" as const },
  { href: "/manage/providers", label: "Providers", icon: "key" as const },
  { href: "/manage/models", label: "Manage models", icon: "code" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
];

type SavedChat = { id: number; title: string; lastUpdated: string };

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [chats, setChats] = useState<SavedChat[]>([]);

  useEffect(() => {
    const loadChats = () => fetch("/api/chats", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json();
        if (Array.isArray(result)) setChats(result);
      })
      .catch(() => setChats([]));
    void loadChats();
    window.addEventListener("chats-updated", loadChats);
    return () => window.removeEventListener("chats-updated", loadChats);
  }, []);

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand-row">
          <Link href="/chat" className="brand-lockup"><span className="brand-mark"><Icon name="sparkles" size={16} /></span><span className="brand-name">nia<span className="brand-period">.</span></span></Link>
          <Button variant="plain" size="icon" aria-label="Collapse sidebar" className="icon-button sidebar-collapse"><Icon name="panel" size={17} /></Button>
        </div>
        <Button variant="outlined" className="new-chat" onClick={() => window.location.assign("/chat")}><Icon name="plus" size={16} /><span>New chat</span><kbd>⌘ K</kbd></Button>

        <div className="nav-label">Workspace</div>
        <nav className="primary-nav" aria-label="Workspace">
          {navigation.map(({ href, label, icon }) => {
            const active = pathname === href || (href === "/chat" && pathname.startsWith("/chat/"));
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-item${active ? " is-active" : ""}`}><Icon name={icon} size={17} /><span>{label}</span>{active && <span className="nav-active-dot" />}</Link>;
          })}
        </nav>

        <div className="history-head"><span className="nav-label">Recent</span><Button variant="plain" size="icon" aria-label="Search chats" className="icon-button"><Icon name="search" size={15} /></Button></div>
        <div className="history-list" aria-label="Saved chats">{chats.length ? chats.map((chat) => <Link key={chat.id} href={`/chat?chatId=${chat.id}`} className="history-item">{chat.title || "Untitled chat"}</Link>) : <span className="history-empty">No saved chats yet</span>}</div>

        <div className="sidebar-bottom">
          <div className="plan-card"><span className="plan-icon"><Icon name="sparkles" size={15} /></span><div><strong>Nia Personal</strong><span>Personal assistant workspace</span></div><span className="online-dot" /></div>
          <Button variant="plain" className="account-button"><span className="avatar">K</span><span className="account-details"><strong>Kishor Neupane</strong><span>Personal workspace</span></span><Icon name="settings" size={16} className="account-settings" /></Button>
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}

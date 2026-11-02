"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import HeaderSidebarV1 from "@neup/components/layout/headerSidebar.v1";
import type { SidebarLink, SidebarLinkGroup } from "@neup/components/layout/headerSidebar.v1";
import { LetterImage } from "@neup/components/ui/letterImage";
import { chatClientService } from "../services/client";
import { Code2, MessageCircle, Plus, Settings2 } from "lucide-react";

type SavedChat = { id: string; title: string; lastUpdated: string };
type SidebarIcon = ComponentType<{ className?: string }>;

/** Builds the sidebar groups from the app navigation and recent conversations. */
function createSidebarLinks(chats: SavedChat[], profile: { name: string; image: string | null } | null): SidebarLinkGroup[] {
  /** Renders the signed-in user's avatar in the shared sidebar navigation. */
  function ProfileSidebarIcon({ className }: { className?: string }) {
    const initials = profile?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "U";
    return <LetterImage src={profile?.image} initials={initials} alt={profile?.name || "Profile"} className={`${className ?? ""} rounded-full`} fontSize="10px" />;
  }

  const links: Array<SidebarLink & { icon: SidebarIcon }> = [
    { href: "/chat", label: "New chat", icon: Plus },
    { href: "/applications", label: "Applications", icon: Code2 },
    { href: "/settings", label: "Manage", icon: Settings2 },
    { href: "/profile", label: "Profile", icon: ProfileSidebarIcon },
  ];

  const groups: SidebarLinkGroup[] = [{ links }];
  if (chats.length) {
    groups.push({
      label: "Recent chats",
      links: chats.map((chat) => ({
        href: `/chat/${chat.id}`,
        label: <span className="block max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">{chat.title || "Untitled chat"}</span>,
        icon: MessageCircle,
      })),
    });
  }
  return groups;
}

/** Renders the shared header/sidebar layout and keeps recent chats current. */
export function WorkspaceShell({ children, profile }: {
  children: ReactNode;
  profile: { name: string; image: string | null; username: string | null } | null;
}) {
  const [chats, setChats] = useState<SavedChat[]>([]);

  useEffect(() => {
    let isMounted = true;
    let isLoading = false;

    /** Refreshes recent chats while retaining the last successful result on errors. */
    const loadChats = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        const response = await chatClientService.list();
        if (!response.ok) return;
        const result = await response.json();
        if (isMounted && Array.isArray(result.chats)) setChats(result.chats);
      } catch {
        // Keep the current sidebar links visible while the network is unavailable.
      } finally {
        isLoading = false;
      }
    };

    void loadChats();
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadChats();
    }, 15_000);
    window.addEventListener("chats-updated", loadChats);
    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("chats-updated", loadChats);
    };
  }, []);

  const headerLinks = (
    <Link key="nia-brand" href="/chat" className="inline-flex items-center gap-2 text-foreground">
      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-primary-foreground"><MessageCircle className="h-4 w-4" /></span>
      <span className="text-xl font-semibold tracking-[-.055em]">nia<span className="text-primary-600">.</span></span>
    </Link>
  );

  return (
    <HeaderSidebarV1
      sidebarlinks={createSidebarLinks(chats, profile)}
      pofileBarInfo={{
        href: "/profile",
        displayName: profile?.name ?? "Profile",
        displayImage: profile?.image,
        neupid: profile?.username ?? null,
      }}
      headerLinks={[headerLinks]}
    >
      {children}
    </HeaderSidebarV1>
  );
}

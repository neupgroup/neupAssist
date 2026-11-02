"use client";
import { chatClientService } from "../services/client";
import { withAppBasePath } from "../services/app-url";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@neup/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@neup/components/ui/alert-dialog";
import { Link } from "@neup/components/ui/link";
import { Userbar } from "@neup/components/element/userbar";
import { Icon } from "./ui-icon";

const navigation = [
  { href: "/chat", label: "Chat", icon: "chat" as const },
  { href: "/manage/keys", label: "Manage keys", icon: "key" as const },
  { href: "/manage/accounts", label: "Accounts", icon: "settings" as const },
  { href: "/manage/logs", label: "Logs", icon: "search" as const },
  { href: "/apps", label: "Apps and Integrations", icon: "code" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
];

type SavedChat = { id: string; title: string; lastUpdated: string };
type WorkspaceProfile = { displayName: string; displayImage: string | null; neupid: string };

export function WorkspaceShell({ children, profile }: { children: React.ReactNode; profile: WorkspaceProfile | null }) {
  const pathname = usePathname();
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [chatActionError, setChatActionError] = useState("");
  const [chatToDelete, setChatToDelete] = useState<SavedChat | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let isLoading = false;

    /** Refreshes the recent conversation list without discarding it on transient errors. */
    const loadChats = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        const response = await chatClientService.list();
        if (!response.ok) return;
        const result = await response.json();
        if (isMounted && Array.isArray(result.chats)) setChats(result.chats);
      } catch {
        // Keep the current list visible while the network is unavailable.
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

  /** Deletes a saved conversation and returns to chat if it is open. */
  async function removeChat(chat: SavedChat) {
    setChatActionError("");
    setDeletingChat(true);
    try {
      const response = await chatClientService.remove(chat.id);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete this chat.");
      setChats((current) => current.filter((entry) => entry.id !== chat.id));
      window.dispatchEvent(new Event("chats-updated"));
      setChatToDelete(null);
      if (pathname === `/chat/${chat.id}`) window.location.assign(withAppBasePath("/chat"));
    } catch (error) {
      setChatActionError(error instanceof Error ? error.message : "Could not delete this chat.");
    } finally {
      setDeletingChat(false);
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <aside className="sidebar-scrollbar relative z-[2] flex h-dvh shrink-0 basis-[264px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain border-r border-border bg-[hsl(var(--sidebar))] px-[15px] pb-[14px] pt-[22px] max-[760px]:basis-[226px] max-[760px]:px-[11px] max-[600px]:fixed max-[600px]:inset-x-0 max-[600px]:bottom-0 max-[600px]:z-[5] max-[600px]:h-[61px] max-[600px]:w-full max-[600px]:flex-row max-[600px]:items-center max-[600px]:justify-center max-[600px]:overflow-y-hidden max-[600px]:border-r-0 max-[600px]:border-t max-[600px]:bg-[#fcfcf9] max-[600px]:px-3 max-[600px]:py-[max(5px,env(safe-area-inset-bottom))]">
        <div className="flex h-[33px] items-center justify-between px-[3px] pl-[3px] pr-1 max-[600px]:hidden">
          <Link href="/chat" className="inline-flex items-center gap-[9px]"><span className="grid h-7 w-7 place-items-center rounded-[9px] bg-[#456f5b] text-white"><Icon name="sparkles" size={16} /></span><span className="text-[21px] font-semibold leading-none tracking-[-.055em]">nia<span className="text-[#6e9a7e">.</span></span></Link>
          <Button variant="plain" size="icon" aria-label="Collapse sidebar" className="icon-button !h-[31px] !w-[31px]"><Icon name="panel" size={17} /></Button>
        </div>
        <Button variant="outlined" className="mt-[27px] !h-10 !w-full !justify-start !gap-[9px] !rounded-[9px] !border-border !bg-white !text-[14px] !font-medium !text-[#353f39] shadow-[0_1px_2px_#18302306] hover:!bg-[#f8faf8] max-[600px]:hidden" onClick={() => window.location.assign(withAppBasePath("/chat"))}><Icon name="plus" size={16} /><span>New chat</span><kbd className="ml-auto rounded-[5px] border border-[#e8ebe7] px-[5px] py-[2px] font-[inherit] text-[10px] text-[#8c948d]">⌘ K</kbd></Button>

        <div className="mt-[29px] mb-[10px] mx-[9px] text-[10px] font-semibold uppercase tracking-[.11em] text-[#919992] max-[600px]:hidden">Workspace</div>
        <nav className="grid gap-[3px] max-[600px]:flex max-[600px]:w-full max-[600px]:max-w-[390px] max-[600px]:justify-around max-[600px]:gap-1" aria-label="Workspace">
          {navigation.map(({ href, label, icon }) => {
            const active = pathname === href || (href === "/chat" && pathname.startsWith("/chat/"));
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative flex h-[38px] items-center gap-[10px] rounded-lg px-[10px] text-[14px] text-[#6d7770] transition-colors hover:bg-[#eff2ed] hover:text-[#38443d] ${active ? "bg-[#e9eee8] font-semibold text-[#345a46]" : ""} max-[600px]:h-[45px] max-[600px]:flex-1 max-[600px]:flex-col max-[600px]:justify-center max-[600px]:gap-[3px] max-[600px]:px-[2px] max-[600px]:py-[3px] max-[600px]:text-[12px] max-[600px]:[&[aria-current=page]]:bg-transparent`}><Icon name={icon} size={17} /><span>{label}</span>{active && <span className="ml-auto h-[5px] w-[5px] rounded-full bg-[#668b70] max-[600px]:absolute max-[600px]:left-1/2 max-[600px]:top-[2px] max-[600px]:m-0 max-[600px]:-translate-x-1/2" />}</Link>;
          })}
        </nav>

        <div className="mx-[3px] mb-2 ml-[9px] mt-[31px] flex items-center justify-between max-[600px]:hidden"><span className="text-[10px] font-semibold uppercase tracking-[.11em] text-[#919992]">Recent</span><Button variant="plain" size="icon" aria-label="Search chats" className="icon-button !h-7 !w-7"><Icon name="search" size={15} /></Button></div>
        <div className="grid gap-px max-[600px]:hidden" aria-label="Saved chats">{chats.length ? chats.map((chat) => <div key={chat.id} className="group flex min-w-0 items-center rounded-[7px] transition-colors hover:bg-[#f0f2ee]"><Link href={`/chat/${chat.id}`} className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-[10px] py-[9px] text-[13px] text-[#778079] hover:text-[#46524a]">{chat.title || "Untitled chat"}</Link><button type="button" className="mr-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-[#929b93] opacity-0 transition-opacity hover:bg-[#fff0ee] hover:text-[#b3544d] focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100" aria-label={`Delete ${chat.title || "Untitled chat"}`} title="Delete chat" onClick={() => { setChatActionError(""); setChatToDelete(chat); }}><Icon name="trash" size={15} /></button></div>) : <span className="px-[10px] py-2 text-[13px] text-[#9aa29b]">No saved chats yet</span>}</div>
        {chatActionError && <p className="mx-[9px] mt-2 text-xs text-[#a2564f]" role="alert">{chatActionError}</p>}

        <div className="mt-auto grid gap-[10px] max-[600px]:hidden">
          {profile && <Link href="/profile" aria-label="Open your profile" className="block min-w-0 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#78927b]"><Userbar displayName={profile.displayName} displayImage={profile.displayImage} neupid={profile.neupid} className="!w-full !justify-start !gap-[9px] !rounded-[9px] !py-[6px] !pl-[10px] !pr-2 hover:!border-[#e7eae4] hover:!bg-[#fffefa]" /></Link>}
        </div>
      </aside>
      <main className="relative flex h-dvh min-w-0 flex-1 flex-col max-[600px]:h-[calc(100dvh-61px)]">{children}</main>
      <AlertDialog open={Boolean(chatToDelete)} onOpenChange={(open) => { if (!open && !deletingChat) setChatToDelete(null); }}>
        <AlertDialogContent className="border-[#e6ebe4] bg-white text-[#344139] sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#344139]">Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#738078]">“{chatToDelete?.title || "Untitled chat"}” and its messages will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingChat} className="!border-[#e2e8e0] !text-[#566258]">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletingChat || !chatToDelete} onClick={() => { if (chatToDelete) void removeChat(chatToDelete); }} className="!border-red-200 !bg-red-600 !text-white hover:!border-red-300 hover:!bg-red-700">{deletingChat ? "Deleting…" : "Delete chat"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

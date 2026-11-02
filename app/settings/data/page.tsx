"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@neup/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@neup/components/ui/alert-dialog";
import { chatClientService } from "@/services/client";
import { Icon } from "../../ui-icon";

/** Provides controls for saved workspace data. */
export default function SettingsDataPage() {
  const [deleteChatsOpen, setDeleteChatsOpen] = useState(false);
  const [deletingChats, setDeletingChats] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /** Deletes the signed-in account's chats after confirmation. */
  async function deleteAllChats() {
    setDeletingChats(true);
    setError("");
    setMessage("");
    try {
      const response = await chatClientService.removeAll();
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete your chats.");
      const count = Number(result.deleted) || 0;
      setMessage(`Deleted ${count} ${count === 1 ? "chat" : "chats"}.`);
      setDeleteChatsOpen(false);
      window.dispatchEvent(new Event("chats-updated"));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete your chats.");
    } finally {
      setDeletingChats(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <AlertDialog open={deleteChatsOpen} onOpenChange={(open) => { if (!deletingChats) setDeleteChatsOpen(open); }}>
        <AlertDialogContent className="border-[#e6ebe4] bg-white text-[#344139] sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#344139]">Delete all your chats?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#738078]">This permanently deletes all saved chats and their messages in your account. This cannot be undone.</AlertDialogDescription>
            {error && <p className="text-[13px] text-red-700" role="alert">{error}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingChats} className="!border-[#e2e8e0] !text-[#566258]">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletingChats} onClick={(event) => { event.preventDefault(); void deleteAllChats(); }} className="!border-red-200 !bg-red-600 !text-white hover:!border-red-300 hover:!bg-red-700">{deletingChats ? "Deleting…" : "Delete all chats"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="mx-auto w-[min(calc(100%-60px),900px)] pt-[56px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-10 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[34px]">
        <div className="mb-[27px]"><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Data</h1><p className="mt-2 text-[15px] text-[#818b83]">Manage the conversation history saved in your workspace.</p></div>
        <article className="rounded-xl border border-[#e6ebe4] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-4"><span className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="chat" size={18} /></span><span><strong className="block text-[14px] font-semibold text-[#3d4941]">Conversation history</strong><span className="mt-1 block text-[13px] leading-5 text-[#858f86]">Delete all saved conversations and their messages for this account.</span></span></span><Button variant="outlined" size="sm" className="!h-[34px] !border-red-200 !text-[13px] !text-red-700 hover:!bg-red-50" onClick={() => { setError(""); setMessage(""); setDeleteChatsOpen(true); }}>Delete all chats</Button></div>
          {message && <p className="mt-3 text-[13px] text-[#52785e]" role="status">{message}</p>}
        </article>
      </div>
    </section>
  );
}

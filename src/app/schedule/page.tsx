"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";

export default function SchedulePage() {
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: balances } = trpc.bookings.myBalances.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: classes, isLoading } = trpc.classes.list.useQuery({
    from: new Date().toISOString().slice(0, 10),
  });

  const { data: myBookings } = trpc.bookings.mine.useQuery(
    { includePast: false },
    { enabled: !!user }
  );

  const book = trpc.bookings.book.useMutation({
    onSuccess: async () => {
      setSelectedClassId(null);
      await utils.classes.list.invalidate();
      await utils.bookings.mine.invalidate();
    },
  });

  const selectedClass = classes?.find(c => c.id === selectedClassId);

  if (isLoading) return <p className="muted">Loading schedule...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Class schedule</h1>
        <p className="muted mt-1 text-sm">
          {classes?.length ?? 0} upcoming classes
        </p>
      </div>

      {book.error && (
        <p className="panel p-3 text-sm" style={{ color: "#f87171" }}>
          {book.error.message}
        </p>
      )}

      <div className="space-y-2">
        {classes?.map((c) => {
          const existingBooking = myBookings?.find(b => b.classId === c.id);
          const isBooked = existingBooking?.status === "booked";
          const isWaitlisted = existingBooking?.status === "waitlisted";

          return (
            <div
              key={c.id}
              className="panel flex items-center gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{c.name}</h2>
                  {c.full && (
                    <span className="rounded px-1.5 py-0.5 text-xs" style={{ background: "#3a2a1a", color: "#fbbf24" }}>
                      Full
                    </span>
                  )}
                  {isBooked && (
                    <span className="rounded px-1.5 py-0.5 text-xs bg-[var(--primary)] text-white">
                      Booked
                    </span>
                  )}
                  {isWaitlisted && (
                    <span className="rounded px-1.5 py-0.5 text-xs" style={{ background: "#3a2a1a", color: "#fbbf24" }}>
                      Waitlisted
                    </span>
                  )}
                </div>
                <p className="muted mt-0.5 text-sm">
                  {formatDateTime(c.startsAt)} &middot; {c.room} &middot;{" "}
                  {c.trainerName ?? "Unassigned"} &middot; {c.durationMin} min
                </p>
              </div>

              <div className="text-right text-sm muted">
                <div>
                  {c.spotsLeft} open spot{c.spotsLeft === 1 ? "" : "s"}
                </div>
                <div>
                  {c.creditCost} credit{c.creditCost === 1 ? "" : "s"}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  className="btn btn-primary"
                  disabled={!user || book.isPending || !!existingBooking}
                  onClick={() => {
                    if (balances?.company) {
                      setSelectedClassId(c.id);
                    } else {
                      book.mutate({ classId: c.id, useCompanyCredits: false });
                    }
                  }}
                >
                  {existingBooking ? "Registered" : c.full ? "Join waitlist" : "Book"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!user && (
        <p className="muted text-sm">Sign in to book a class.</p>
      )}

      {selectedClass && balances?.company && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel max-w-md w-full p-6 space-y-6 bg-[var(--bg-panel)]">
            <div>
              <h2 className="text-xl font-bold">How would you like to pay?</h2>
              <p className="muted text-sm mt-1">
                Booking: {selectedClass.name}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                className="panel w-full p-4 text-left hover:bg-[var(--bg-hover)] flex justify-between items-center"
                onClick={() => book.mutate({ classId: selectedClass.id, useCompanyCredits: false })}
                disabled={book.isPending}
              >
                <div>
                  <div className="font-medium">Personal Membership</div>
                  <div className="text-sm muted">
                    {balances.personal 
                      ? (balances.personal.unlimited ? "Unlimited credits" : `${balances.personal.creditsRemaining} credits remaining`)
                      : "No active membership"}
                  </div>
                </div>
                <div className="text-[var(--primary)] font-bold px-2">&rarr;</div>
              </button>
              
              <button
                className="panel w-full p-4 text-left hover:bg-[var(--bg-hover)] flex justify-between items-center"
                onClick={() => book.mutate({ classId: selectedClass.id, useCompanyCredits: true })}
                disabled={book.isPending}
              >
                <div>
                  <div className="font-medium">Corporate Credits</div>
                  <div className="text-sm muted">
                    {balances.company.name} &middot; {balances.company.creditPoolBalance} pool credits
                  </div>
                </div>
                <div className="text-[var(--primary)] font-bold px-2">&rarr;</div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                className="btn"
                onClick={() => setSelectedClassId(null)}
                disabled={book.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

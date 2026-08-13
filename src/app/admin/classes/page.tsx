"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";

export default function AdminClassesPage() {
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: classes, isLoading: loadingClasses } = trpc.classes.list.useQuery({
    from: new Date().toISOString().slice(0, 10),
  });
  const { data: trainers } = trpc.trainers.list.useQuery();

  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [creditCost, setCreditCost] = useState("1");
  const [trainerId, setTrainerId] = useState("");

  const createClass = trpc.classes.create.useMutation({
    onSuccess: async () => {
      setIsCreating(false);
      setName("");
      setRoom("");
      setCapacity("10");
      setStartsAt("");
      setDurationMin("60");
      setCreditCost("1");
      setTrainerId("");
      await utils.classes.list.invalidate();
    },
  });

  const cancelClass = trpc.classes.cancel.useMutation({
    onSuccess: async () => {
      await utils.classes.list.invalidate();
    },
  });

  if (loadingClasses) return <p className="muted">Loading classes...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manage Schedule</h1>
          <p className="muted mt-1 text-sm">Create and cancel classes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
          Create Class
        </button>
      </div>

      {isCreating && (
        <div className="panel p-6 space-y-4">
          <h2 className="text-lg font-medium">New Class</h2>
          
          {createClass.error && (
            <div className="text-[#f87171] text-sm">{createClass.error.message}</div>
          )}
          
          <form 
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createClass.mutate({
                name,
                room,
                capacity: parseInt(capacity, 10),
                startsAt: new Date(startsAt).toISOString(),
                durationMin: parseInt(durationMin, 10),
                creditCost: parseInt(creditCost, 10),
                trainerId: trainerId ? parseInt(trainerId, 10) : undefined,
              });
            }}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium">Class Name</label>
              <input required type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Yoga" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Room</label>
              <input required type="text" className="input" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Studio A" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Start Time</label>
              <input required type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Trainer</label>
              <select className="input" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
                <option value="">Unassigned</option>
                {trainers?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Capacity</label>
              <input required type="number" min="1" className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Duration (mins)</label>
              <input required type="number" min="15" className="input" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Credit Cost</label>
              <input required type="number" min="0" className="input" value={creditCost} onChange={(e) => setCreditCost(e.target.value)} />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setIsCreating(false)} disabled={createClass.isPending}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={createClass.isPending}>
                {createClass.isPending ? "Creating..." : "Save Class"}
              </button>
            </div>
          </form>
        </div>
      )}

      {cancelClass.error && (
        <div className="panel p-3 text-sm" style={{ color: "#f87171" }}>
          {cancelClass.error.message}
        </div>
      )}

      <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {classes?.length === 0 && (
          <div className="p-6 text-center text-sm muted">No upcoming classes scheduled.</div>
        )}
        
        {classes?.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-medium flex items-center gap-2">
                {c.name}
                {c.cancelled && (
                  <span className="rounded px-1.5 py-0.5 text-xs bg-[#451a1a] text-[#f87171]">
                    Cancelled
                  </span>
                )}
              </div>
              <div className="text-sm muted mt-0.5">
                {formatDateTime(c.startsAt)} &middot; {c.room} &middot; {c.trainerName ?? "Unassigned"}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right text-sm muted">
                <div>{c.booked}/{c.capacity} booked</div>
                <div>{c.creditCost} credits</div>
              </div>
              
              {!c.cancelled && user?.role === "admin" && (
                <>
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="btn btn-sm"
                  >
                    Edit
                  </Link>
                  <button
                    className="btn btn-sm text-[#f87171] hover:bg-[#451a1a]"
                    disabled={cancelClass.isPending}
                    onClick={() => {
                      if (confirm(`Are you sure you want to cancel ${c.name}? All bookings will be refunded.`)) {
                        cancelClass.mutate({ id: c.id });
                      }
                    }}
                  >
                    Cancel Class
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

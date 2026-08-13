"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";
import Link from "next/link";

function EditForm({ cls, classId, trainers }: { cls: any; classId: number; trainers: any }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [name, setName] = useState(cls.name);
  const [room, setRoom] = useState(cls.room);
  const [capacity, setCapacity] = useState(cls.capacity.toString());
  const [startsAt, setStartsAt] = useState(cls.startsAt.slice(0, 16));
  const [trainerId, setTrainerId] = useState(cls.trainerId ? cls.trainerId.toString() : "");
  
  const [availabilityMessage, setAvailabilityMessage] = useState<{text: string, isError: boolean} | null>(null);

  const updateClass = trpc.classes.update.useMutation({
    onSuccess: async () => {
      await utils.classes.byId.invalidate({ id: classId });
      await utils.classes.list.invalidate();
      router.push("/admin/classes");
    },
  });

  const checkAvailability = trpc.trainers.checkAvailability.useQuery(
    {
      trainerId: parseInt(trainerId, 10) || 0,
      startsAt: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
      durationMin: cls?.durationMin ?? 60,
    },
    {
      enabled: false, // Only run manually
    }
  );

  const handleCheckAvailability = async () => {
    if (!trainerId || !startsAt) {
      setAvailabilityMessage({ text: "Please select a trainer and start time first.", isError: true });
      return;
    }
    
    try {
      const result = await checkAvailability.refetch();
      if (result.data?.available) {
        setAvailabilityMessage({ text: "Trainer is available!", isError: false });
      } else {
        setAvailabilityMessage({ text: result.data?.reason || "Trainer is not available.", isError: true });
      }
    } catch (e: any) {
      setAvailabilityMessage({ text: e.message || "Failed to check availability.", isError: true });
    }
  };

  return (
    <div className="panel p-6 space-y-4 h-fit">
      <h2 className="text-lg font-medium">Class Details</h2>
      
      {updateClass.error && (
        <div className="text-[#f87171] text-sm">{updateClass.error.message}</div>
      )}
      
      <form 
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateClass.mutate({
            id: classId,
            name,
            room,
            capacity: parseInt(capacity, 10),
            startsAt: new Date(startsAt).toISOString(),
            trainerId: trainerId ? parseInt(trainerId, 10) : null,
          });
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">Class Name</label>
          <input required type="text" className="input w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Room</label>
          <input required type="text" className="input w-full" value={room} onChange={(e) => setRoom(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Start Time</label>
          <input required type="datetime-local" className="input w-full" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        
        <div className="space-y-1">
          <label className="text-sm font-medium">Capacity</label>
          <input required type="number" min="1" className="input w-full" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Trainer</label>
          <div className="flex gap-2">
            <select className="input flex-1" value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
              <option value="">Unassigned</option>
              {trainers?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button 
              type="button" 
              className="btn btn-sm"
              onClick={handleCheckAvailability}
              disabled={checkAvailability.isFetching}
            >
              {checkAvailability.isFetching ? "Checking..." : "Check"}
            </button>
          </div>
          {availabilityMessage && (
            <p className="text-xs mt-1" style={{ color: availabilityMessage.isError ? "#f87171" : "#4ade80" }}>
              {availabilityMessage.text}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button type="submit" className="btn btn-primary" disabled={updateClass.isPending}>
            {updateClass.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminClassEditPage() {
  const params = useParams();
  const classId = parseInt(params.id as string, 10);
  
  const { data: cls, isLoading } = trpc.classes.byId.useQuery({ id: classId }, {
    retry: false,
  });
  
  const { data: trainers } = trpc.trainers.list.useQuery();

  if (isLoading) return <p className="muted">Loading class details...</p>;
  if (!cls) return <p className="muted">Class not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/classes" className="btn btn-sm">
          &larr; Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Class: {cls.name}</h1>
          <p className="muted mt-1 text-sm">
            {formatDateTime(cls.startsAt)} &middot; {cls.durationMin} mins &middot; {cls.creditCost} credits
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <EditForm cls={cls} classId={classId} trainers={trainers} />

        <div className="panel p-6 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Roster</h2>
            <span className="text-sm muted">{cls.roster.length} / {cls.capacity} booked</span>
          </div>
          
          {cls.roster.length === 0 ? (
            <p className="muted text-sm text-center py-4">No one has booked this class yet.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {cls.roster.map((r: any) => (
                <div key={r.bookingId} className="flex justify-between items-center py-3">
                  <div>
                    <div className="font-medium text-sm">{r.memberName}</div>
                    <div className="text-xs muted">{r.memberEmail}</div>
                  </div>
                  <span className="text-xs uppercase tracking-wide muted px-2 py-1 rounded bg-[var(--bg-hover)]">
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

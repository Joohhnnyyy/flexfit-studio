"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export default function AdminMembersPage() {
  const [query, setQuery] = useState("");
  const { data: members, isLoading } = trpc.members.search.useQuery({
    q: query,
    limit: 50,
  });

  const utils = trpc.useUtils();

  const setActive = trpc.members.setActive.useMutation({
    onSuccess: () => utils.members.search.invalidate(),
  });

  const setRole = trpc.members.setRole.useMutation({
    onSuccess: () => utils.members.search.invalidate(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Member Directory</h1>
          <p className="muted mt-1 text-sm">Manage users, roles, and account status</p>
        </div>
      </div>

      <div className="panel p-6">
        <input 
          type="text" 
          className="input w-full md:w-96" 
          placeholder="Search by name or email..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
        />
      </div>

      <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
        {isLoading ? (
          <div className="p-6 text-center text-sm muted">Searching...</div>
        ) : members?.length === 0 ? (
          <div className="p-6 text-center text-sm muted">No members found.</div>
        ) : (
          members?.map((m) => (
            <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {m.name}
                  {!m.active && (
                    <span className="rounded px-1.5 py-0.5 text-xs bg-[#451a1a] text-[#f87171]">
                      Inactive
                    </span>
                  )}
                  {m.role === "admin" && (
                    <span className="rounded px-1.5 py-0.5 text-xs bg-[var(--primary)] text-white">
                      Admin
                    </span>
                  )}
                  {m.role === "trainer" && (
                    <span className="rounded px-1.5 py-0.5 text-xs bg-[var(--accent)] text-white">
                      Trainer
                    </span>
                  )}
                </div>
                <div className="text-sm muted mt-0.5">
                  {m.email} &middot; {m.phone || "No phone"}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <select 
                  className="input text-sm py-1 h-auto"
                  value={m.role}
                  disabled={setRole.isPending}
                  onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value as "member" | "trainer" | "admin" })}
                >
                  <option value="member">Member</option>
                  <option value="trainer">Trainer</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  className="btn btn-sm"
                  disabled={setActive.isPending}
                  onClick={() => setActive.mutate({ id: m.id, active: !m.active })}
                >
                  {m.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

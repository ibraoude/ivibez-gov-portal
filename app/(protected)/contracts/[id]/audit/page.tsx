
// app/(protected)/contracts/[id]/audit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuditLog = {
  id: string;
  record_id: string;
  action: string;
  metadata?: any;
  changed_at: string;
  actor_email?: string | null;
};

export default function AuditPage() {
  const supabase = createClient();
  const params = useParams() as { id: string };
  const id = params.id;

  // ✅ Hooks at top level
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("record_id", id)
          .order("changed_at", { ascending: false });

        if (error) throw new Error(error.message);
        if (!cancelled) setLogs((data as AuditLog[]) || []);
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message || "Failed to load audit history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [id, supabase]);

  // ===== Render states (early returns AFTER hooks are safe) =====
  if (loading) {
    return (
      <div className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Audit History</h1>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded border bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Audit History</h1>
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Audit History</h1>

      {logs.length === 0 ? (
        <div className="rounded border bg-white p-4 text-sm text-gray-600">No audit entries yet.</div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded border bg-white p-4">
              <p className="text-sm font-medium">{log.action}</p>
              <p className="text-xs text-gray-500">
                {new Date(log.changed_at).toLocaleString()}
                {log.actor_email ? ` • ${log.actor_email}` : ""}
              </p>

              {log.metadata ? (
                <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client'

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function AuditPage() {
  const { id } = useParams();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("record_id", id)
        .order("changed_at", { ascending: false });

      setLogs(data || []);
    };

    fetchLogs();
  }, [id]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Audit History</h1>

      {logs.map(log => (
        <div key={log.id} className="border rounded p-4 mb-3">
          <p className="text-sm font-medium">{log.action}</p>
          <p className="text-xs text-gray-500">
            {new Date(log.changed_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
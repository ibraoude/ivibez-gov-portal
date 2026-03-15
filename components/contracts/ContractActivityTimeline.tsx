"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Activity = {
  id: string;
  activity_type: string;
  note: string | null;
  actor_email: string | null;
  created_at: string;
};

export default function ContractActivityTimeline({
  contractId,
}: {
  contractId: string;
}) {
  const supabase = createClient();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    const { data } = await supabase
      .from("contract_activity")
      .select("id,activity_type,note,actor_email,created_at")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });

    setActivities(data ?? []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        Loading activity...
      </div>
    );
  }

  if (!activities.length) {
    return (
      <div className="text-sm text-gray-500">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {activities.map((a) => (

        <div
          key={a.id}
          className="flex gap-3 border-b pb-3"
        >

          <div className="mt-2 h-2 w-2 rounded-full bg-blue-500" />

          <div>

            <div className="text-sm font-medium">
              {a.note ?? a.activity_type}
            </div>

            <div className="text-xs text-gray-500">
              {a.actor_email ?? "System"} •{" "}
              {new Date(a.created_at).toLocaleString()}
            </div>

          </div>

        </div>

      ))}

    </div>
  );
}
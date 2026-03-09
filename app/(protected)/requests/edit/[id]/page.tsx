
// app/(protected)/requests/edit/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PrimeRequestWizard from "@/app/components/PrimeRequestWizard";

type RequestRow = {
  id: string;
  submitted_by: string;
  awarded: boolean;
  // add other fields your wizard needs...
};

export default function EditRequestPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const supabase = createClient();

  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<RequestRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1) Auth check
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          // Send to login and bring them back here afterward
          const params = new URLSearchParams({ returnTo: `/requests/edit/${id}` });
          router.replace(`/login?${params.toString()}`);

          return;
        }

        // 2) Load request
        const { data, error } = await supabase
          .from("service_requests")
          .select("*")
          .eq("id", id)
          .single();

        if (error || !data) {
          console.error(error);
          router.replace("/requests"); // not found -> go to list
          return;
        }

        // 3) Ownership check (user can only edit own request)
        if (data.submitted_by !== user.id) {
          router.replace("/requests"); // no permission -> go to list
          return;
        }

        // 4) Lock editing after award
        if (data.awarded) {
          alert("This request has been awarded and cannot be edited.");
          router.replace("/contracts"); // or "/requests" if you prefer
          return;
        }

        if (mounted) {
          setInitialData(data as RequestRow);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (mounted) {
          setErrorMsg("Something went wrong while loading the request.");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id, router, supabase]);

  if (loading) return <div className="p-10">Loading...</div>;
  if (errorMsg) return <div className="p-10 text-red-600">{errorMsg}</div>;
  if (!initialData) return <div className="p-10">No request data found.</div>;

  return <PrimeRequestWizard mode="edit" initialRequest={initialData} />;
}

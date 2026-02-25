'use client'

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PrimeRequestWizard from "@/app/dashboard/components/PrimeRequestWizard"; 
// (we’ll create this component in Step 4)

export default function EditRequestPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error(error);
        router.push("/dashboard");
        return;
      }

      // ✅ security: user can only edit their own request
      if (data.submitted_by !== userData.user.id) {
        router.push("/dashboard");
        return;
      }

      // 🚫 LOCK EDITING AFTER AWARD
      if (data.awarded) {
        alert("This contract has been awarded and cannot be edited.");
        router.push("/dashboard");
        return;
      }

      setInitialData(data);
      setLoading(false);
    };

    load();
  }, [id, router]);

  if (loading) return <div className="p-10">Loading...</div>;

  return (
    <PrimeRequestWizard mode="edit" initialRequest={initialData} />
  );
}
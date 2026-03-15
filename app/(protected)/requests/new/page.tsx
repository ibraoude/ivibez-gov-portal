'use client'

import ProtectedPage from "@/components/auth/ProtectedPage";
import PrimeRequestWizard from "@/app/components/PrimeRequestWizard";

export default function NewRequestPage() {
  return (
    <ProtectedPage>
      <PrimeRequestWizard mode="new" />
    </ProtectedPage>
  );
}
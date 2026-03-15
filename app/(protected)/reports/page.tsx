import ProtectedPage from "@/components/auth/ProtectedPage";
import ReportsPage from "./ReportsPage";

export default function Page() {
  return (
    <ProtectedPage permission="viewReports">
      <ReportsPage />
    </ProtectedPage>
  );
}
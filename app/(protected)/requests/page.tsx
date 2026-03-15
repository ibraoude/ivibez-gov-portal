import ProtectedPage from "@/components/auth/ProtectedPage";
import RequestsPage from "./RequestsPage";

export default function Page() {
  return (
    <ProtectedPage>
      <RequestsPage />
    </ProtectedPage>
  );
}
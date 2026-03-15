import ProtectedPage from "@/components/auth/ProtectedPage";
import UsersDirectoryPage from "./UsersDirectoryPage";

export default function Page() {
  return (
    <ProtectedPage>
      <UsersDirectoryPage />
    </ProtectedPage>
  );
}
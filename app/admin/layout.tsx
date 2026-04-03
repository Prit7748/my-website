import AuthInactivityGuard from "@/components/AuthInactivityGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthInactivityGuard />
      {children}
    </>
  );
}
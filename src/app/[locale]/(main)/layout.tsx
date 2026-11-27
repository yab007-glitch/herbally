import { MainPageShell } from "@/components/layout/main-page-shell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainPageShell>{children}</MainPageShell>;
}

import { redirect } from "@/i18n/navigation";

/** The former demo dashboard is replaced by the role-protected staff area. */
export default async function DashboardRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/admin", locale });
}

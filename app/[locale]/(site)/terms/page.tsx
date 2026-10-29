import { notFound } from "next/navigation";
import { ownerConfig } from "@/config/owner";

/**
 * Terms and conditions are published only once the owner supplies legally
 * approved text (decision L-01). Until then this route does not exist.
 */
export default function TermsPage() {
  if (!ownerConfig.legal.termsApproved) notFound();
  return null;
}

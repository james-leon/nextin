import { AlertCircle } from "lucide-react";
import { CalloutCard } from "@/components/ui/callout-card";

/** Erreur de formulaire annoncée immédiatement (role="alert"). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <CalloutCard tone="red" role="alert" icon={<AlertCircle />}>
      {message}
    </CalloutCard>
  );
}

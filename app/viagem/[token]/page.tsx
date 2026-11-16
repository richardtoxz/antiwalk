import type { Metadata } from "next";
import RideView from "../../components/RideView";

export const metadata: Metadata = {
  title: "Viagem compartilhada",
  description: "Acompanhe ao vivo o ônibus de quem compartilhou esta viagem.",
  // Each link belongs to one ride and one person: never in search results.
  robots: { index: false, follow: false },
};

export default async function SharedRidePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RideView token={token} />;
}

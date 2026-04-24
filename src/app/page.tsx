import { redirect } from "next/navigation";

// Redirect to dashboard — the dashboard layout handles auth checks
export default function HomePage() {
  redirect("/dashboard");
}

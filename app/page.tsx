import { redirect } from "next/navigation";

/** AScope opens directly on the live network dashboard. */
export default function HomePage() {
  redirect("/dashboard");
}

import { redirect } from "next/navigation";

/** ArcScope opens directly on the live network dashboard. */
export default function HomePage() {
  redirect("/dashboard");
}

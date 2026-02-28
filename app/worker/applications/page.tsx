import { redirect } from "next/navigation";

export default function WorkerApplicationsRedirect() {
  redirect("/marketplace?tab=applications");
}

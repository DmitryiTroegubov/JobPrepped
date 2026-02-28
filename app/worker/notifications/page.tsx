import { redirect } from "next/navigation";

export default function WorkerNotificationsRedirect() {
  redirect("/marketplace?tab=notifications");
}

import { redirect } from "next/navigation";

export default function EmployerHomeScreen() {
  redirect("/marketplace?tab=dashboard");
}

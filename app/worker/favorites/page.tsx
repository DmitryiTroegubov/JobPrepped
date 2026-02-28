import { redirect } from "next/navigation";

export default function WorkerFavoritesRedirect() {
  redirect("/marketplace?tab=favorites");
}

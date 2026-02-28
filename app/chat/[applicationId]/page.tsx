import { redirect } from "next/navigation";

export default async function ChatAliasPage({
  params
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/applications/${applicationId}/chat`);
}

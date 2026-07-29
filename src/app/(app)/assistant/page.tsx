import { requireUser } from "@/lib/current-user";
import { Chat } from "./Chat";

export default async function AssistantPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">AI Assistant</h1>
        <p className="text-sm text-zinc-500">
          Ask questions about your school&apos;s students, fees, attendance, and results.
        </p>
      </div>
      <Chat />
    </div>
  );
}

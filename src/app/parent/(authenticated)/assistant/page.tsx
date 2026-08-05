import { requireParent } from "@/lib/current-parent";
import { ParentChat } from "./ParentChat";

export default async function ParentAssistantPage() {
  await requireParent();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">AI Assistant</h1>
        <p className="text-sm text-zinc-500">
          Ask questions about your child&apos;s attendance, fees, and results.
        </p>
      </div>
      <ParentChat />
    </div>
  );
}

import { CheckResultForm } from "./CheckResultForm";

export const dynamic = "force-dynamic";

export default function CheckResultPage() {
  return (
    <div className="mx-auto min-h-screen max-w-lg space-y-6 bg-zinc-50 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Check Result</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the serial and PIN from your result checker card, plus the student&rsquo;s
          admission number.
        </p>
      </div>
      <CheckResultForm />
    </div>
  );
}

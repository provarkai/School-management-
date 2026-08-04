export function FacilitiesDisabledNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-zinc-900">Facilities isn&apos;t enabled</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        This module isn&apos;t turned on for your school. Contact support if you&apos;d like it
        enabled.
      </p>
    </div>
  );
}

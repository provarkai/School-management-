import { AuthForms } from "./AuthForms";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          School Manager
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Fees · Attendance · Report cards · Reminders
        </p>
      </div>
      <AuthForms />
    </div>
  );
}

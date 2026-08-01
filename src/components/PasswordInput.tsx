"use client";

import { useState } from "react";

export function PasswordInput({
  name,
  required,
  className,
  autoComplete,
}: {
  name: string;
  required?: boolean;
  className?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        className={`${className ?? ""} pr-14`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-zinc-500 hover:text-zinc-900"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

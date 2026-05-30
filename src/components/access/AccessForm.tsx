"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { KeyRound } from "lucide-react";

type AccessFormProps = {
  error?: string | null;
  pending?: boolean;
  onSubmit: (accessKey: string) => Promise<void>;
};

export function AccessForm({
  error,
  pending = false,
  onSubmit
}: AccessFormProps) {
  const [accessKey, setAccessKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isDisabled = pending || submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit(accessKey.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-screen">
      <form className="access-form" onSubmit={handleSubmit}>
        <div className="access-form__icon" aria-hidden="true">
          <KeyRound size={24} />
        </div>
        <h1>SMS Inbox</h1>
        <label htmlFor="access-key">访问密钥</label>
        <input
          id="access-key"
          type="password"
          value={accessKey}
          onChange={(event) => setAccessKey(event.target.value)}
          autoComplete="current-password"
          disabled={isDisabled}
          required
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={isDisabled}>
          {isDisabled ? "验证中" : "进入"}
        </button>
      </form>
    </main>
  );
}

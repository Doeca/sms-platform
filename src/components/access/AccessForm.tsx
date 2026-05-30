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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(accessKey);
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
          disabled={pending}
          required
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "验证中" : "进入"}
        </button>
      </form>
    </main>
  );
}

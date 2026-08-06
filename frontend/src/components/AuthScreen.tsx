import { useState } from "react";
import { api } from "../api";
import type { CurrentUser } from "../api";

export function AuthScreen({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!nickname.trim()) {
      setError("Введи нікнейм");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const user = mode === "register" ? await api.register(nickname) : await api.login(nickname);
      onAuthed(user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>🌱 Habit Tracker</h1>
        <p className="tagline">Маленькі кроки, великі зміни</p>

        <div className="auth-tabs">
          <button
            className={mode === "register" ? "auth-tab active" : "auth-tab"}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Реєстрація
          </button>
          <button
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Вхід
          </button>
        </div>

        <label className="field">
          <span>Нікнейм</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="напр. taras_qa"
            autoFocus
          />
        </label>

        {error && <div className="field-error">{error}</div>}

        <button className="btn-primary auth-submit" onClick={submit} disabled={busy}>
          {mode === "register" ? "Створити акаунт" : "Увійти"}
        </button>

        <p className="auth-hint">
          {mode === "register"
            ? "Нікнейм має бути унікальним — під ним зберігаються тільки твої звички."
            : "Введи нікнейм, яким уже реєструвався."}
        </p>
      </div>
    </div>
  );
}

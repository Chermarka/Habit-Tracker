import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { WeeklyMatrix } from "./components/WeeklyMatrix";
import { Archive } from "./components/Archive";
import { CreateHabitModal } from "./components/CreateHabitModal";
import { AuthScreen } from "./components/AuthScreen";
import { getSession, clearSession } from "./api";
import type { CurrentUser } from "./api";
import "./App.css";

type Tab = "today" | "week" | "archive";

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(() => getSession());
  const [tab, setTab] = useState<Tab>("today");
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>🌱 Habit Tracker</h1>
          <p className="tagline">Маленькі кроки, великі зміни</p>
        </div>
        <div className="header-actions">
          <span className="user-pill">👤 {user.nickname}</span>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Створити звичку
          </button>
          <button className="btn-secondary" onClick={logout}>
            Вийти
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === "today" ? "tab active" : "tab"} onClick={() => setTab("today")}>
          📅 Сьогодні
        </button>
        <button className={tab === "week" ? "tab active" : "tab"} onClick={() => setTab("week")}>
          🗓️ Тиждень
        </button>
        <button className={tab === "archive" ? "tab active" : "tab"} onClick={() => setTab("archive")}>
          🗄️ Архів
        </button>
      </nav>

      <main className="app-main">
        {tab === "today" && <Dashboard key={`today-${refreshKey}`} />}
        {tab === "week" && <WeeklyMatrix key={`week-${refreshKey}`} />}
        {tab === "archive" && <Archive key={`archive-${refreshKey}`} />}
      </main>

      {showCreate && (
        <CreateHabitModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

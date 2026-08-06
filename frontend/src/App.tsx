import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { WeeklyMatrix } from "./components/WeeklyMatrix";
import { Analytics } from "./components/Analytics";
import { Archive } from "./components/Archive";
import { CreateHabitModal } from "./components/CreateHabitModal";
import "./App.css";

type Tab = "today" | "week" | "analytics" | "archive";

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>🌱 Habit Tracker</h1>
          <p className="tagline">Маленькі кроки, великі зміни</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Створити звичку
        </button>
      </header>

      <nav className="tabs">
        <button className={tab === "today" ? "tab active" : "tab"} onClick={() => setTab("today")}>
          📅 Сьогодні
        </button>
        <button className={tab === "week" ? "tab active" : "tab"} onClick={() => setTab("week")}>
          🗓️ Тиждень
        </button>
        <button className={tab === "analytics" ? "tab active" : "tab"} onClick={() => setTab("analytics")}>
          📊 Аналітика
        </button>
        <button className={tab === "archive" ? "tab active" : "tab"} onClick={() => setTab("archive")}>
          🗄️ Архів
        </button>
      </nav>

      <main className="app-main">
        {tab === "today" && <Dashboard key={`today-${refreshKey}`} />}
        {tab === "week" && <WeeklyMatrix key={`week-${refreshKey}`} />}
        {tab === "analytics" && <Analytics key={`analytics-${refreshKey}`} />}
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

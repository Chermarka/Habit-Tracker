import { useEffect, useState, type CSSProperties } from "react";
import { api } from "../api";
import type { DashboardHabit } from "../api";
import { todayStr, formatHuman } from "../dateUtils";
import { ArchiveConfirmModal } from "./ArchiveConfirmModal";
import { colorForIndex } from "../palette";

export function Dashboard() {
  const [habits, setHabits] = useState<DashboardHabit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DashboardHabit | null>(null);
  const date = todayStr();

  async function load() {
    try {
      const data = await api.getDashboard(date);
      setHabits(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBinary(h: DashboardHabit) {
    const next = !h.completed;
    // optimistic update — AC 2.1 вимагає оновлення UI без перезавантаження, < 100ms
    setHabits((prev) =>
      prev.map((x) => (x.id === h.id ? { ...x, completed: next, streak: x.streak + (next ? 1 : -1) } : x))
    );
    try {
      await api.checkIn(h.id, { date, completed: next });
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  }

  async function submitNumeric(h: DashboardHabit, value: number) {
    try {
      await api.checkIn(h.id, { date, value });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Сьогодні · {formatHuman(date)}</h2>
      {error && <div className="banner-error">{error}</div>}
      <ul className="habit-list">
        {habits.map((h, i) => {
          const style = { "--habit-color": colorForIndex(i) } as CSSProperties;
          return (
            <li key={h.id} className="habit-row" style={style}>
              {h.type === "BINARY" ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    className="hab-checkbox"
                    checked={!!h.completed}
                    onChange={() => toggleBinary(h)}
                  />
                  <span className={h.completed ? "habit-name done" : "habit-name"}>{h.name}</span>
                </label>
              ) : (
                <NumericRow habit={h} onSubmit={(v) => submitNumeric(h, v)} />
              )}
              <span className={h.streak > 0 ? "streak lit" : "streak"} title="Streak">
                🔥 {h.streak}
              </span>
              <button className="btn-icon" title="Архівувати" onClick={() => setArchiveTarget(h)}>
                🗄
              </button>
            </li>
          );
        })}
        {habits.length === 0 && <li className="empty">Немає активних звичок. Створи першу.</li>}
      </ul>

      {archiveTarget && (
        <ArchiveConfirmModal
          habitName={archiveTarget.name}
          onClose={() => setArchiveTarget(null)}
          onConfirm={async () => {
            await api.archiveHabit(archiveTarget.id);
            setArchiveTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function NumericRow({ habit, onSubmit }: { habit: DashboardHabit; onSubmit: (v: number) => void }) {
  const [value, setValue] = useState(String(habit.value ?? 0));
  const pct = habit.targetValue ? Math.min(100, Math.round(((habit.value ?? 0) / habit.targetValue) * 100)) : 0;

  return (
    <div className="numeric-row">
      <span className="habit-name">{habit.name}</span>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">
        {habit.value ?? 0} / {habit.targetValue} {habit.unit} ({habit.status === "IN_PROGRESS" ? "В процесі" : habit.status === "COMPLETED" ? "Виконано" : "Не розпочато"})
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="numeric-input"
      />
      <button className="btn-secondary" onClick={() => onSubmit(Number(value))}>
        OK
      </button>
    </div>
  );
}

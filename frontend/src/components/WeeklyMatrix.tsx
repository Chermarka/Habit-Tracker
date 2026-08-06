import { useEffect, useState, type CSSProperties } from "react";
import { api } from "../api";
import type { WeekResponse } from "../api";
import { todayStr, addDays, startOfWeek, DOW_LABELS } from "../dateUtils";
import { colorForIndex } from "../palette";

export function WeeklyMatrix() {
  const [anchor, setAnchor] = useState(todayStr());
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.getWeek(startOfWeek(anchor));
      setWeek(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  async function toggleCell(habitId: string, date: string, editable: boolean, current?: boolean) {
    if (!editable) return; // AC 3.3 — майбутні дати неактивні
    try {
      await api.checkIn(habitId, { date, completed: !current });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!week) return <div>Завантаження...</div>;

  return (
    <div>
      <div className="week-nav">
        <button className="btn-secondary" onClick={() => setAnchor(addDays(anchor, -7))}>
          ← Попередній тиждень
        </button>
        <span>
          {week.weekStart} — {week.weekEnd}
        </span>
        <button className="btn-secondary" onClick={() => setAnchor(addDays(anchor, 7))}>
          Наступний тиждень →
        </button>
      </div>
      {error && <div className="banner-error">{error}</div>}

      <table className="week-table">
        <thead>
          <tr>
            <th>Звичка</th>
            {week.habits[0]?.days.map((d, i) => (
              <th key={d.date}>
                {DOW_LABELS[i]}
                <br />
                <small>{d.date.slice(5)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.habits.map((h, i) => {
            const color = colorForIndex(i);
            const rowStyle = { "--row-color": color } as CSSProperties;
            return (
              <tr key={h.id} style={rowStyle}>
                <td className="habit-name">
                  <span className="week-row-label">
                    <span className="dot" style={{ "--dot-color": color } as CSSProperties} />
                    {h.name}
                  </span>
                </td>
                {h.days.map((d) => (
                  <td key={d.date}>
                    {h.type === "BINARY" ? (
                      <button
                        className={`week-cell ${d.completed ? "done" : ""} ${!d.editable ? "disabled" : ""}`}
                        disabled={!d.editable}
                        onClick={() => toggleCell(h.id, d.date, d.editable, d.completed)}
                        title={!d.editable ? "Майбутня дата недоступна" : undefined}
                      >
                        {d.completed ? "✓" : ""}
                      </button>
                    ) : (
                      <span className={`week-cell numeric ${!d.editable ? "disabled" : ""}`}>
                        {d.value ?? "–"}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {week.habits.length === 0 && (
            <tr>
              <td colSpan={8} className="empty">
                Немає активних звичок
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

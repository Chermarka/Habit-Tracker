import { useEffect, useState } from "react";
import { api } from "../api";
import type { DashboardHabit, Habit } from "../api";
import { formatHuman } from "../dateUtils";

type HeatCell = { date: string; percentage: number; done?: number; total?: number };

export function Analytics() {
  const [habits, setHabits] = useState<(DashboardHabit | Habit)[]>([]);
  const [selectedId, setSelectedId] = useState<string>("__all__");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [cells, setCells] = useState<HeatCell[]>([]);
  const [hover, setHover] = useState<HeatCell | null>(null);

  useEffect(() => {
    (async () => {
      const [active, archived] = await Promise.all([api.getDashboard(new Date().toISOString().slice(0, 10)), api.getArchived()]);
      setHabits([...active, ...archived]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (selectedId === "__all__") {
        setCells(await api.getAggregateHeatmap(year, month));
      } else {
        setCells(await api.getHabitHeatmap(selectedId, year, month));
      }
    })();
  }, [selectedId, year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const cellByDate = new Map(cells.map((c) => [c.date, c]));

  function colorFor(pct: number) {
    if (pct === 0) return "var(--heat-0)";
    if (pct < 25) return "var(--heat-1)";
    if (pct < 50) return "var(--heat-2)";
    if (pct < 75) return "var(--heat-3)";
    return "var(--heat-4)";
  }

  function textColorFor(pct: number) {
    return pct >= 50 ? "#ffffff" : "var(--ink)";
  }

  return (
    <div>
      <h2>Аналітика</h2>
      <div className="analytics-controls">
        <label>
          Звичка
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="__all__">Усі звички (агрегат)</option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Рік
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
        <label>
          Місяць
          <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
        </label>
      </div>

      <div className="heatmap-grid">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const cell = cellByDate.get(dateStr);
          const pct = cell?.percentage ?? 0;
          return (
            <div
              key={dateStr}
              className="heat-cell"
              style={{ background: colorFor(pct), color: textColorFor(pct) }}
              onMouseEnter={() => setHover(cell ?? { date: dateStr, percentage: 0 })}
              onMouseLeave={() => setHover(null)}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      {hover && (
        <div className="tooltip">
          {formatHuman(hover.date)}:{" "}
          {selectedId === "__all__" && hover.total != null
            ? `виконано ${hover.done}/${hover.total} звичок (${hover.percentage}%)`
            : `${hover.percentage}% виконання`}
        </div>
      )}

      <p className="hint">
        Примітка: AC 4.1 описує heatmap для конкретної звички, а приклад тултипу з AC 4.2 ("4/5 звичок") — це
        агрегат по всіх звичках за день. Тут доступні обидва режими через селектор вище.
      </p>
    </div>
  );
}

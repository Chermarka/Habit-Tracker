import { useEffect, useState, type CSSProperties } from "react";
import { api } from "../api";
import type { Habit } from "../api";
import { colorForIndex } from "../palette";

export function Archive() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    api.getArchived().then(setHabits);
  }, []);

  return (
    <div>
      <h2>Архів</h2>
      <ul className="habit-list">
        {habits.map((h, i) => (
          <li key={h.id} className="habit-row" style={{ "--habit-color": colorForIndex(i) } as CSSProperties}>
            <span className="week-row-label">
              <span className="dot" style={{ "--dot-color": colorForIndex(i) } as CSSProperties} />
              <span className="habit-name">{h.name}</span>
            </span>
            <span className="archived-at">
              заархівовано {h.archivedAt ? new Date(h.archivedAt).toLocaleDateString("uk-UA") : ""}
            </span>
          </li>
        ))}
        {habits.length === 0 && <li className="empty">Архів порожній</li>}
      </ul>
    </div>
  );
}

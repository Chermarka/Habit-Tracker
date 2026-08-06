import { useState } from "react";
import { api } from "../api";
import type { HabitType } from "../api";

export function CreateHabitModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<HabitType>("BINARY");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setNameError("Назва є обов'язковою");
      return;
    }
    setNameError(null);
    setSubmitError(null);
    try {
      await api.createHabit({
        name: name.trim(),
        type,
        targetValue: type === "NUMERIC" ? Number(targetValue) : undefined,
        unit: type === "NUMERIC" ? unit.trim() : undefined,
      });
      onCreated();
      onClose();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Створити звичку</h2>

        <label className="field">
          <span>Назва</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError(null);
            }}
            placeholder="напр. Медитація"
          />
          {nameError && <span className="field-error">{nameError}</span>}
        </label>

        <label className="field">
          <span>Тип</span>
          <select value={type} onChange={(e) => setType(e.target.value as HabitType)}>
            <option value="BINARY">Завершено / Не завершено</option>
            <option value="NUMERIC">Числова</option>
          </select>
        </label>

        {type === "NUMERIC" && (
          <>
            <label className="field">
              <span>Цільове значення</span>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="напр. 2000"
              />
            </label>
            <label className="field">
              <span>Одиниця виміру</span>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="напр. мл" />
            </label>
          </>
        )}

        {submitError && <div className="field-error">{submitError}</div>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

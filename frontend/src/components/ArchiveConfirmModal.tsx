export function ArchiveConfirmModal({
  habitName,
  onConfirm,
  onClose,
}: {
  habitName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Архівувати звичку?</h2>
        <p>
          «{habitName}» зникне з дашборду й тижневої сітки. Статистика збережеться і буде доступна в аналітиці
          та архіві.
        </p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Скасувати
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            Архівувати
          </button>
        </div>
      </div>
    </div>
  );
}

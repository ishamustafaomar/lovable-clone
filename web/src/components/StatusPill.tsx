import { STATUS_LABEL, isBusy, type ProjectStatus } from "../types";

export default function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`pill pill-${status}`}>
      {isBusy(status) ? <span className="spinner spinner-xs" /> : <span className="pill-dot" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

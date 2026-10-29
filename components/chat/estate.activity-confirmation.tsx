export type EstateActivity = {
  leadName?: string | null;
  activityType: string;
  followUpMethod: string | null;
  remarks: string;
  activityOn: string | null;
};

/** Formats an activity timestamp as a readable relative time. */
function formatActivityDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(elapsedSeconds);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  const [unit, secondsPerUnit] = units.find(([, seconds]) => absoluteSeconds >= seconds) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(elapsedSeconds / secondsPerUnit), unit);
}

/** Presents a successfully recorded estate lead activity. */
export function EstateActivityConfirmation({ activity }: { activity: EstateActivity }) {
  const activityName = activity.activityType.replaceAll("_", " ");
  const date = formatActivityDate(activity.activityOn);
  const leadName = activity.leadName?.trim() || "Lead";

  return <article className="estate-activity-confirmation" aria-label={`${leadName}: ${activityName}`}>
    <span className="estate-activity-check" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="m5 12.5 4.5 4.5L19 7" />
      </svg>
    </span>
    <div className="estate-activity-content">
      <div className="estate-activity-heading">
        <strong>{leadName}</strong>
        <span>{activityName}</span>
      </div>
      <p className="estate-activity-remarks">{activity.remarks}</p>
      {date && <time className="estate-activity-meta" dateTime={activity.activityOn ?? undefined}>{date}</time>}
    </div>
  </article>;
}

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

  return <article className="my-[10px] mb-3 flex w-full max-w-[460px] items-start gap-3 rounded-xl border border-[#dce9dc] bg-gradient-to-br from-white to-[#f7fbf6] p-[13px] shadow-[0_5px_18px_rgb(54_91_59_/_6%)] motion-safe:animate-[estate-activity-card-in_.42s_cubic-bezier(.2,.75,.25,1)_both]" aria-label={`${leadName}: ${activityName}`}>
    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full bg-[#e5f2e5] text-[#47794d] motion-safe:animate-[estate-activity-check-pop_.38s_.12s_cubic-bezier(.2,1.6,.4,1)_both]" aria-hidden="true">
      <svg className="h-[21px] w-[21px]" viewBox="0 0 24 24" focusable="false">
        <path className="fill-none stroke-current [stroke-width:2.4] [stroke-linecap:round] [stroke-linejoin:round] [stroke-dasharray:24] [stroke-dashoffset:24] motion-safe:animate-[estate-activity-tick_.42s_.32s_ease-out_forwards] motion-reduce:[stroke-dashoffset:0]" d="m5 12.5 4.5 4.5L19 7" />
      </svg>
    </span>
    <div className="grid min-w-0 gap-[5px]">
      <div className="flex flex-wrap items-center gap-[5px] text-[14px] text-[#67736a]">
        <strong className="font-semibold text-[#435046]">{leadName}</strong>
        <span>{activityName}</span>
      </div>
      <p className="whitespace-pre-wrap text-[14px] leading-[1.5] text-[#67736a]">{activity.remarks}</p>
      {date && <time className="text-[12px] leading-[1.4] text-[#858f86]" dateTime={activity.activityOn ?? undefined}>{date}</time>}
    </div>
  </article>;
}

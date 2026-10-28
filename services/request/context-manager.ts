import requests from "./context.json";
import { getPersonalBasics } from "@/services/context/personal.basics";
import { getPersonalNotifications } from "@/services/context/personal.notifications";

type RequestCatalog = Record<string, string[]>;

const catalog = requests as RequestCatalog;
const knownRequests = new Set(Object.values(catalog).flat());

export type ContextRequest = string;

/** Finds a request command only when the complete assistant reply is a known command. */
export function isContextRequest(reply: string): ContextRequest | null {
  const normalized = reply.trim();
  if (normalized === "--req--") return normalized;
  return knownRequests.has(normalized) ? normalized : null;
}

/** Collects app-owned and authenticated account data for a context command. */
export const contextManager = {
  /** Builds the JSON context payload appended to the model conversation. */
  async collect(request: ContextRequest): Promise<Record<string, unknown>> {
    const scope = request === "--req--" ? [] : request.slice("--req.".length, -2).split(".");
    const data: Record<string, unknown> = { request, available: true };

    if (request === "--req--") {
      const personalBasics = await getPersonalBasics();
      data.availableRequests = catalog.default.filter((command) => command !== "--req--");
      data.sampleData = {
        profile: personalBasics.profile,
        profileAvailable: personalBasics.available,
        calendar: [
          { title: "Project planning", date: "2026-10-30", start: "10:00", end: "10:45" },
          { title: "Team check-in", date: "2026-10-30", start: "14:00", end: "14:30" },
        ],
        tasks: [{ title: "Review project proposal", due: "2026-10-30", status: "open" }],
        notes: [{ title: "Project priorities", text: "Focus on launch readiness and customer feedback." }],
      };
      data.instruction = "Use the sampleData included here when it answers the user. If more specific data is needed, respond with only one relevant command from availableRequests.";
    }

    if (scope[0] === "personal") {
      const personalBasics = scope.length === 1 || scope.includes("bio") ? await getPersonalBasics() : null;
      if (personalBasics) {
        data.profile = personalBasics.profile;
        data.profileAvailable = personalBasics.available;
      }
      if (scope.length === 1 || scope.includes("settings") || scope.includes("preferences")) data.settings = { language: "English", weekStartsOn: "Sunday", responseStyle: "Concise" };
      if (scope.includes("notifications")) data.notifications = await getPersonalNotifications();
      if (scope.includes("contacts")) data.contacts = [{ name: "Jordan Lee", relationship: "Colleague", email: "jordan.lee@example.com" }];
      if (scope.includes("calendar")) data.calendar = [{ title: "Project planning", date: "2026-10-30", start: "10:00", end: "10:45" }];
      if (scope.includes("tasks")) data.tasks = [{ title: "Review project proposal", due: "2026-10-30", status: "open" }];
      if (scope.includes("notes")) data.notes = [{ title: "Project priorities", text: "Focus on launch readiness and customer feedback." }];
      if (scope.includes("reminders")) data.reminders = [{ title: "Send project update", due: "2026-10-30", completed: false }];
    }

    if (scope[0] === "calendar" || request === "--req.calendar--" || (scope[0] === "personal" && scope.includes("calendar"))) {
      data.calendar = [
        { title: "Project planning", date: "2026-10-30", start: "10:00", end: "10:45" },
        { title: "Team check-in", date: "2026-10-30", start: "14:00", end: "14:30" },
      ];
    }

    if (scope[0] === "estate" || ["--req.lead--", "--req.tasks--", "--req.notes--", "--req.reminders--"].includes(request)) {
      const estateData = {
        leads: [{ name: "Taylor Reed", email: "taylor.reed@example.com", interest: "Two-bedroom apartment", status: "new", followUp: "2026-10-30" }],
        properties: [{ name: "Riverside Apartments", type: "Apartment", bedrooms: 2, price: 285000, status: "available" }],
        tasks: [{ title: "Follow up with Taylor Reed", due: "2026-10-30", status: "open" }],
        notes: [{ title: "Taylor Reed inquiry", text: "Interested in a two-bedroom apartment near the river." }],
        reminders: [{ title: "Call Taylor Reed", due: "2026-10-30", completed: false }],
        contacts: [{ name: "Taylor Reed", role: "Prospective buyer", email: "taylor.reed@example.com" }],
        appointments: [{ title: "Property viewing", contact: "Taylor Reed", date: "2026-10-31", start: "11:00" }],
      };
      const requestedCategory = scope[0] === "estate" ? scope[1] : request.slice("--req.".length, -2);
      data.applicationData = requestedCategory && requestedCategory in estateData
        ? { [requestedCategory]: estateData[requestedCategory as keyof typeof estateData] }
        : estateData;
    }

    return data;
  },
};

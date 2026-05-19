export const LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CONVERTED",
  "LOST",
] as const;

export const LEAD_TYPES = ["HOT", "WARM", "COLD", "DEAD"] as const;

export const REMARK_TYPES = [
  "General",
  "Phone Call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Follow-up",
  "Not Interested",
] as const;

export const CALL_OUTCOMES = [
  "Connected",
  "No Answer",
  "Busy",
  "Wrong Number",
  "Callback Requested",
] as const;

export const MAX_BULK_SIZE = 50;

export const MESSAGE_TOKENS = ["{name}", "{city}", "{mobile}"];

/** Quick templates — original Index.html style */
export const WA_TEMPLATES = [
  { label: "Greeting", text: "Hi {name}, hope you are doing well!" },
  { label: "Follow-up", text: "Hi {name}, this is regarding your enquiry from {city}. Please let us know a good time to connect." },
  { label: "Offer", text: "Hello {name}, we have an exclusive offer for you. Reply YES for details." },
  { label: "Reminder", text: "Hi {name}, gentle reminder — our team tried reaching you on {mobile}." },
];

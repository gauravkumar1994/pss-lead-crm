import type { WhatsAppProvider } from "@prisma/client";

export type ProviderField = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number";
  required: boolean;
  placeholder?: string;
  help?: string;
};

export type ProviderMeta = {
  id: WhatsAppProvider;
  label: string;
  description: string;
  supportsMedia: boolean;
  mediaNote?: string;
  fields: ProviderField[];
};

/** Server-side registry — no secrets, only UI metadata + capabilities */
export const WHATSAPP_PROVIDER_REGISTRY: ProviderMeta[] = [
  {
    id: "ULTRAMSG",
    label: "UltraMsg",
    description: "UltraMsg cloud WhatsApp API",
    supportsMedia: true,
    fields: [
      { key: "instanceId", label: "Instance ID", type: "text", required: true },
      { key: "accessToken", label: "Token", type: "password", required: true },
      { key: "phone", label: "Sender Phone (optional)", type: "text", required: false },
    ],
  },
  {
    id: "ATOZSENDER",
    label: "AtozSender",
    description: "AtozSender WhatsApp API (text + image; PDF rejected for media)",
    supportsMedia: true,
    mediaNote: "Use image URLs only. PDF links are rejected for media sends.",
    fields: [
      { key: "instanceId", label: "Instance / API Key", type: "text", required: true },
      { key: "accessToken", label: "Secret Token", type: "password", required: true },
    ],
  },
  {
    id: "EVOLUTION",
    label: "Evolution API",
    description: "Self-hosted Evolution API — requires your base URL",
    supportsMedia: true,
    fields: [
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        required: true,
        placeholder: "https://evolution.yourdomain.com",
        help: "Your Evolution server root URL (no trailing slash)",
      },
      { key: "instanceId", label: "Instance Name", type: "text", required: true },
      { key: "accessToken", label: "API Key", type: "password", required: true },
    ],
  },
];

export function getProviderMeta(id: WhatsAppProvider): ProviderMeta | undefined {
  return WHATSAPP_PROVIDER_REGISTRY.find((p) => p.id === id);
}

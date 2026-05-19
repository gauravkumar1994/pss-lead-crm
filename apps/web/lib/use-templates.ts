"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type MessageTemplate = {
  id: string;
  name: string;
  body: string;
  category: string;
};

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    api<{ items: MessageTemplate[] }>("/templates")
      .then((r) => setTemplates(r.items))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  return { templates, loading, reload };
}

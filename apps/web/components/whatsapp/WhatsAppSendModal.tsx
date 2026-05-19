"use client";

import { SingleWhatsAppPanel } from "@/components/whatsapp/SingleWhatsAppPanel";

type Lead = {
  id: string;
  name: string;
  mobile: string;
  city?: string;
  whatsappCount?: number;
};

export function WhatsAppSendModal({
  lead,
  onClose,
  onSent,
}: {
  lead: Lead;
  onClose: () => void;
  onSent?: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Single WhatsApp — {lead.name}</h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <SingleWhatsAppPanel
            lead={lead}
            onSent={() => {
              onSent?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

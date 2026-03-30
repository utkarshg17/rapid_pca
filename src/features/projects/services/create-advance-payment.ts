import { supabase } from "@/lib/supabase/client";

type CreateAdvancePaymentInput = {
  projectId: number;
  recordDate: string;
  pettyContractorId: number;
  pettyContractorName: string;
  advancePaymentAmount: number;
  advancePaymentDescription?: string;
  createdByUserId: number;
  createdByUserName: string;
};

export async function createAdvancePayment(input: CreateAdvancePaymentInput) {
  const entryGroupId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  const { error } = await supabase.from("muster_roll").insert({
    project_id: input.projectId,
    record_date: input.recordDate,
    petty_contractor_id: input.pettyContractorId,
    petty_contractor_name: input.pettyContractorName.trim(),
    crew_name: "",
    crew_type: "",
    regular_hours: null,
    overtime_hours: null,
    rate: null,
    advance_payment: input.advancePaymentAmount,
    advance_payment_description:
      input.advancePaymentDescription?.trim() || null,
    entry_group_id: entryGroupId,
    created_by_user_id: input.createdByUserId,
    created_by_user_name: input.createdByUserName,
  });

  if (error) {
    console.error("Error creating advance payment:", error);
    throw new Error(error.message || "Failed to save advance payment.");
  }
}

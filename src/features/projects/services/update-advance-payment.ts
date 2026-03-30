import { supabase } from "@/lib/supabase/client";

type UpdateAdvancePaymentInput = {
  rowId: number;
  recordDate: string;
  pettyContractorId: number;
  pettyContractorName: string;
  advancePaymentAmount: number;
  advancePaymentDescription?: string;
};

export async function updateAdvancePayment(input: UpdateAdvancePaymentInput) {
  const { error } = await supabase
    .from("muster_roll")
    .update({
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
    })
    .eq("id", input.rowId);

  if (error) {
    console.error("Error updating advance payment:", error);
    throw new Error(error.message || "Failed to update advance payment.");
  }
}

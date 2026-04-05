import { NextResponse } from "next/server";

import {
  sharedUnitConsistencyNotes,
} from "@/app/api/job-estimates/shared-unit-consistency";

type FlooringDraftRequestBody = {
  estimate: {
    id: number;
    projectName: string;
    projectType: string;
  };
  projectDetails?: {
    city?: string;
    state?: string;
    country?: string;
    contractType?: string;
    foundationType?: string;
    superstructureType?: string;
  };
  rows: Array<{
    sourceRowId: number;
    roomType: string;
    areaSqft: number;
    floorFinish: string;
  }>;
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      refusal?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const openAiUrl = "https://api.openai.com/v1/chat/completions";
const model = "gpt-5.4";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  let body: FlooringDraftRequestBody;

  try {
    body = (await request.json()) as FlooringDraftRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "At least one flooring source row is required." },
      { status: 400 }
    );
  }

  const promptPayload = {
    estimate: {
      projectName: body.estimate.projectName,
      projectType: body.estimate.projectType,
      location: [body.projectDetails?.city, body.projectDetails?.state, body.projectDetails?.country]
        .filter((value) => typeof value === "string" && value.trim())
        .join(", "),
      contractType: body.projectDetails?.contractType ?? "",
      foundationType: body.projectDetails?.foundationType ?? "",
      superstructureType: body.projectDetails?.superstructureType ?? "",
    },
    costingContext: {
      item: "Flooring",
      costCode: "C3024",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      notes: [
        "Return realistic draft rates per sq.ft for material, labour, and equipment.",
        "Equipment may be 0 when clearly not applicable.",
        "Use flooring scope only; do not include unrelated civil or structural work.",
        "Assume Indian construction context.",
        ...sharedUnitConsistencyNotes,
        "Be conservative and practical rather than aggressive.",
      ],
    },
    rows: body.rows,
  };

  const openAiResponse = await fetch(openAiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an experienced Indian construction estimator preparing a conceptual flooring cost draft for estimator review. Use the project context and each room's floor finish description to estimate practical per-sq.ft material, labour, and equipment costs in INR. Keep assumptions short and specific. Return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "flooring_cost_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              rows: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    sourceRowId: { type: "integer" },
                    assumedFinishSystem: { type: "string" },
                    materialCostPerSqft: { type: "number" },
                    labourCostPerSqft: { type: "number" },
                    equipmentCostPerSqft: { type: "number" },
                    assumptions: { type: "string" },
                    confidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                  },
                  required: [
                    "sourceRowId",
                    "assumedFinishSystem",
                    "materialCostPerSqft",
                    "labourCostPerSqft",
                    "equipmentCostPerSqft",
                    "assumptions",
                    "confidence",
                  ],
                },
              },
            },
            required: ["rows"],
          },
        },
      },
    }),
  });

  const responseJson = (await openAiResponse.json()) as OpenAIChatCompletionResponse;

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ?? "OpenAI request failed while generating flooring draft.",
      },
      { status: openAiResponse.status }
    );
  }

  const message = responseJson.choices?.[0]?.message;

  if (message?.refusal) {
    return NextResponse.json(
      { error: message.refusal },
      { status: 400 }
    );
  }

  const content = message?.content;

  if (!content) {
    return NextResponse.json(
      { error: "OpenAI returned an empty response." },
      { status: 500 }
    );
  }

  try {
    const parsed = JSON.parse(content) as {
      rows: Array<{
        sourceRowId: number;
        assumedFinishSystem: string;
        materialCostPerSqft: number;
        labourCostPerSqft: number;
        equipmentCostPerSqft: number;
        assumptions: string;
        confidence: "low" | "medium" | "high";
      }>;
    };

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse the AI flooring draft response." },
      { status: 500 }
    );
  }
}




import { NextResponse } from "next/server";

import { buildDsrPromptNotes, fetchRelevantDsrRates } from "@/app/api/job-estimates/shared-dsr-rates";
import { buildPricingFallbackPromptNotes, buildWebPricingContext } from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type InteriorDoorsDraftRequestBody = {
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
  areaTakeoffs: Array<{
    roomType: string;
    areaSqft: number;
    floorFinish: string;
  }>;
  finishes?: Array<{
    finishType?: string;
    description?: string;
  }>;
  openings: Array<{
    sourceRowId: number;
    openingName: string;
    heightMm: number;
    widthMm: number;
    quantity: number;
    totalAreaSqft: number;
    description: string;
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
const model = "gpt-5.4-nano";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  let body: InteriorDoorsDraftRequestBody;

  try {
    body = (await request.json()) as InteriorDoorsDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.openings) || body.openings.length === 0) {
    return NextResponse.json(
      { error: "At least one door opening row is required." },
      { status: 400 }
    );
  }

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: ["door", "door shutter", "door frame", "flush door", "hardware", "lock", "latch", "hinge"],
    targetUnits: ["sq.ft", "sq.m"],
  });
  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["sq.ft", "sq.m"],
    targetUnitLabel: "INR per sq.ft",
    itemName: "Interior Doors",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: ["door", "door shutter", "door frame", "flush door", "hardware", "lock", "latch", "hinge"],
  });

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
      item: "Interior Doors",
      costCode: "C1021",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      notes: [
        "Use the supplied door opening rows as the quantity basis. Do not predict quantity or area; use each row's provided totalAreaSqft directly.",
        "Estimate realistic per-sq.ft material, labour, and equipment costs in INR for interior doors only.",
        "Material cost per sq.ft must include the door frame, shutter/actual door leaf, hardware such as lock, latch, hinges, handles, fasteners, and clearly necessary accessories.",
        "Labour cost per sq.ft must include frame fixing, shutter installation, hardware fixing, alignment, finishing touches required for installation, and related door installation labour.",
        "Equipment cost per sq.ft may include clearly applicable installation tools or small equipment, and may be 0 when not materially relevant.",
        "If the opening description suggests a specific door type, size class, or quality level, use it. If not, make a practical best-fit assumption for an interior door based on project type and location.",
        "Assume Indian construction context.",
        ...buildDsrPromptNotes("INR per sq.ft"),
        ...buildPricingFallbackPromptNotes("INR per sq.ft"),
        ...sharedUnitConsistencyNotes,
      ],
    },
    dsrReferenceRates,
    webPricingContext,
    areaTakeoffs: body.areaTakeoffs,
    finishInputs: body.finishes ?? [],
    doorOpenings: body.openings,
  };

  let openAiResponse: Response;
  let responseJson: OpenAIChatCompletionResponse;

  try {
    openAiResponse = await fetch(openAiUrl, {
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
            "You are an experienced Indian construction estimator preparing a conceptual interior door cost draft for estimator review. Use the project details, area takeoffs, finishes, and provided door opening rows to estimate practical per-sq.ft material, labour, and equipment costs in INR. Do not estimate quantities; use the supplied totalAreaSqft for each row. Include frame, shutter, and door hardware in material cost. Keep assumptions short and specific. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interior_doors_cost_draft",
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
                    assumedDoorSystem: { type: "string" },
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
                    "assumedDoorSystem",
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

    responseJson = (await openAiResponse.json()) as OpenAIChatCompletionResponse;
  } catch (error) {
    console.error(
      "Failed to read the OpenAI response for interior doors draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating interior doors draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating interior doors draft.",
      },
      { status: openAiResponse.status }
    );
  }

  const message = responseJson.choices?.[0]?.message;

  if (message?.refusal) {
    return NextResponse.json({ error: message.refusal }, { status: 400 });
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
        assumedDoorSystem: string;
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
      { error: "Failed to parse the AI interior doors draft response." },
      { status: 500 }
    );
  }
}




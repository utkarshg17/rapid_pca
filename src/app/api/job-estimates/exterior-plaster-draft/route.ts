import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import {
  buildBenchmarkPromptNotes,
  resolveEstimatingBenchmarkContext,
} from "@/app/api/job-estimates/shared-estimating-secrets";
import { buildDsrPromptNotes, fetchRelevantDsrRates } from "@/app/api/job-estimates/shared-dsr-rates";
import { buildPricingFallbackPromptNotes, buildWebPricingContext } from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type ExteriorPlasterDraftRequestBody = {
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
    totalPlotArea?: string;
    basementCount?: string;
    basementArea?: string;
    superstructureFootprint?: string;
    stiltFloorCount?: string;
    floorCount?: string;
  };
  areaTakeoffs: Array<{
    roomType: string;
    areaSqft: number;
    floorFinish: string;
  }>;
  finishDescription: string;
  allFinishes?: Array<{
    finishType: string;
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

  let body: ExteriorPlasterDraftRequestBody;

  try {
    body = (await request.json()) as ExteriorPlasterDraftRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.areaTakeoffs) || body.areaTakeoffs.length === 0) {
    return NextResponse.json(
      { error: "Area takeoff rows are required for exterior plaster estimation." },
      { status: 400 }
    );
  }

  const grossFloorAreaSqft = calculateGrossFloorAreaSqft({
    superstructureFootprint: body.projectDetails?.superstructureFootprint,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });
  const benchmarkContext = resolveEstimatingBenchmarkContext({
    lineItemCode: "B2016",
    projectType: body.estimate.projectType,
    foundationType: body.projectDetails?.foundationType,
    superstructureType: body.projectDetails?.superstructureType,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: ["exterior plaster", "external plaster", "cement plaster", "plaster"],
    targetUnits: ["sq.ft", "sq.m"],
  });
  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["sq.ft", "sq.m"],
    targetUnitLabel: "INR per sq.ft",
    itemName: "Exterior Plaster",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: ["exterior plaster", "external plaster", "cement plaster", "plaster"],
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
      totalPlotArea: body.projectDetails?.totalPlotArea ?? "",
      basementCount: body.projectDetails?.basementCount ?? "",
      basementArea: body.projectDetails?.basementArea ?? "",
      superstructureFootprint: body.projectDetails?.superstructureFootprint ?? "",
      stiltFloorCount: body.projectDetails?.stiltFloorCount ?? "",
      floorCount: body.projectDetails?.floorCount ?? "",
      grossFloorAreaSqft,
    },
    costingContext: {
      item: "Exterior Plaster",
      costCode: "B2016",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      finishDescription:
        body.finishDescription.trim() ||
        "No user-entered exterior plaster description provided. Assume a standard exterior plaster finish suitable for the project location.",
      notes: [
        "Estimate the total exterior plaster area in sq.ft from the project details and room program.",
        "Do not jump directly to total quantity. Start from benchmarkContext.finalRatioPerSqftGfa as the default area-per-GFA benchmark and adjust only if the project inputs clearly justify it, then multiply that benchmark by GFA to get the final total area.",
        `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
        "If the exterior plaster finish description is missing, assume a standard plaster finish suited to the project location.",
        "Return practical conceptual rates per sq.ft for material, labour, and equipment.",
        "Equipment may be 0 when clearly not applicable.",
        "Assume Indian construction context.",
        ...buildBenchmarkPromptNotes(benchmarkContext),
        ...buildDsrPromptNotes("INR per sq.ft"),
        ...buildPricingFallbackPromptNotes("INR per sq.ft"),
        ...sharedUnitConsistencyNotes,
      ],
    },
    benchmarkContext,
    dsrReferenceRates,
    webPricingContext,
    areaTakeoffs: body.areaTakeoffs,
    finishInputs: body.allFinishes ?? [],
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
            "You are an experienced Indian construction estimator preparing a conceptual exterior plaster cost draft for estimator review. Use the project details, area takeoffs, exterior plaster finish description, and benchmarkContext when available. Do not estimate the total area directly. Start from benchmarkContext.finalRatioPerSqftGfa as the default area anchor, adjust it only when the project inputs clearly justify it, and then multiply that benchmark by GFA to get the final total area. Estimate a realistic total exterior plaster area in sq.ft, practical per-sq.ft material, labour, and equipment costs in INR, and keep assumptions short and specific. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "exterior_plaster_cost_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              item: { type: "string" },
              areaSqft: { type: "number" },
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
              "item",
              "areaSqft",
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
    }),
    });

    responseJson = (await openAiResponse.json()) as OpenAIChatCompletionResponse;
  } catch (error) {
    console.error(
      "Failed to read the OpenAI response for exterior plaster draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating exterior plaster draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating exterior plaster draft.",
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
      item: string;
      areaSqft: number;
      assumedFinishSystem: string;
      materialCostPerSqft: number;
      labourCostPerSqft: number;
      equipmentCostPerSqft: number;
      assumptions: string;
      confidence: "low" | "medium" | "high";
    };

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse the AI exterior plaster draft response." },
      { status: 500 }
    );
  }
}





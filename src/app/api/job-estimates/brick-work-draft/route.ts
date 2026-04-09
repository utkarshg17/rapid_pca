import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import {
  buildBenchmarkPromptNotes,
  resolveEstimatingBenchmarkContext,
} from "@/app/api/job-estimates/shared-estimating-secrets";
import { buildDsrPromptNotes, fetchRelevantDsrRates } from "@/app/api/job-estimates/shared-dsr-rates";
import { buildPricingFallbackPromptNotes, buildWebPricingContext } from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type BrickWorkDraftRequestBody = {
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
  finishDescriptions: {
    exteriorBrickwork?: string;
    interiorBrickwork?: string;
  };
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

  let body: BrickWorkDraftRequestBody;

  try {
    body = (await request.json()) as BrickWorkDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.areaTakeoffs) || body.areaTakeoffs.length === 0) {
    return NextResponse.json(
      { error: "Area takeoff rows are required for brick work estimation." },
      { status: 400 }
    );
  }

  const grossFloorAreaSqft = calculateGrossFloorAreaSqft({
    superstructureFootprint: body.projectDetails?.superstructureFootprint,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });
  const benchmarkContext = resolveEstimatingBenchmarkContext({
    lineItemCode: "C1018",
    projectType: body.estimate.projectType,
    foundationType: body.projectDetails?.foundationType,
    superstructureType: body.projectDetails?.superstructureType,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: ["brick", "brick work", "brickwork", "brick masonry", "mortar"],
    targetUnits: ["cu.m", "cum", "m3"],
  });
  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["cu.m", "cum", "m3"],
    targetUnitLabel: "INR per cu.m",
    itemName: "Brick Work",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: ["brick", "brick work", "brickwork", "brick masonry", "mortar"],
  });

  const promptPayload = {
    estimate: {
      projectName: body.estimate.projectName,
      projectType: body.estimate.projectType,
      location: [
        body.projectDetails?.city,
        body.projectDetails?.state,
        body.projectDetails?.country,
      ]
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
      item: "Brick Work",
      costCode: "C1018",
      unit: "cu.m",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      exteriorBrickworkDescription:
        body.finishDescriptions.exteriorBrickwork?.trim() ||
        "No user-entered exterior brickwork description provided. Assume a standard exterior brickwork system suitable for the project location.",
      interiorBrickworkDescription:
        body.finishDescriptions.interiorBrickwork?.trim() ||
        "No user-entered interior brickwork description provided. Assume a standard interior brickwork system suitable for the project location.",
      notes: [
        "Prepare separate rows for Exterior Brickwork and Interior Brickwork.",
        "Do not jump directly to total quantity. Start from benchmarkContext.finalRatioPerSqftGfa as the combined brickwork quantity-per-GFA benchmark, then split that combined benchmark between Exterior Brickwork and Interior Brickwork based on project inputs.",
        `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
        "Estimate the brickwork quantity in cu.m for each row using the project details, area takeoffs, and finishes.",
        "If the user has not provided a finish description, assume a location-appropriate standard brickwork system.",
        "If you infer wall thickness in mm, convert source areas from sq.ft to sq.m first and convert thickness from mm to meters before calculating cu.m.",
        "Material cost must include both bricks and mortar needed for fixing the brickwork.",
        "Return practical conceptual costs per cu.m for material, labour, and equipment.",
        "Equipment may be 0 when clearly not applicable.",
        "Assume Indian construction context.",
        ...buildBenchmarkPromptNotes(benchmarkContext),
        ...buildDsrPromptNotes("INR per cu.m"),
        ...buildPricingFallbackPromptNotes("INR per cu.m"),
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
            "You are an experienced Indian construction estimator preparing a conceptual brick work cost draft for estimator review. Use the project details, area takeoffs, finish descriptions, and benchmarkContext when available. Do not estimate the total quantity directly. Start from benchmarkContext.finalRatioPerSqftGfa as the combined brickwork quantity-per-GFA anchor, then split that combined quantity between Exterior Brickwork and Interior Brickwork based on project inputs. Estimate realistic separate brickwork quantities in cu.m for Exterior Brickwork and Interior Brickwork, practical per-cu.m material, labour, and equipment costs in INR, and keep assumptions short and specific. Material cost must include both bricks and mortar. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "brick_work_cost_draft",
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
                    item: {
                      type: "string",
                      enum: ["Exterior Brickwork", "Interior Brickwork"],
                    },
                    quantityCum: { type: "number" },
                    assumedSystem: { type: "string" },
                    materialCostPerCum: { type: "number" },
                    labourCostPerCum: { type: "number" },
                    equipmentCostPerCum: { type: "number" },
                    assumptions: { type: "string" },
                    confidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                  },
                  required: [
                    "item",
                    "quantityCum",
                    "assumedSystem",
                    "materialCostPerCum",
                    "labourCostPerCum",
                    "equipmentCostPerCum",
                    "assumptions",
                    "confidence",
                  ],
                },
                minItems: 2,
                maxItems: 2,
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
      "Failed to read the OpenAI response for brick work draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating brick work draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating brick work draft.",
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
        item: "Exterior Brickwork" | "Interior Brickwork";
        quantityCum: number;
        assumedSystem: string;
        materialCostPerCum: number;
        labourCostPerCum: number;
        equipmentCostPerCum: number;
        assumptions: string;
        confidence: "low" | "medium" | "high";
      }>;
    };

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse the AI brick work draft response." },
      { status: 500 }
    );
  }
}





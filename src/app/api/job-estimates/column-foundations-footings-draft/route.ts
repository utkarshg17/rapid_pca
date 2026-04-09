import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import {
  buildBenchmarkPromptNotes,
  resolveEstimatingBenchmarkContext,
} from "@/app/api/job-estimates/shared-estimating-secrets";
import { buildDsrPromptNotes, fetchRelevantDsrRates } from "@/app/api/job-estimates/shared-dsr-rates";
import { buildPricingFallbackPromptNotes, buildWebPricingContext } from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type ColumnFoundationsFootingsDraftRequestBody = {
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
const applicableFoundationTypes = new Set([
  "isolated footing",
  "isolated footing + combined footing",
]);

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  let body: ColumnFoundationsFootingsDraftRequestBody;

  try {
    body = (await request.json()) as ColumnFoundationsFootingsDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.areaTakeoffs) || body.areaTakeoffs.length === 0) {
    return NextResponse.json(
      {
        error:
          "Area takeoff rows are required for column foundations + footings estimation.",
      },
      { status: 400 }
    );
  }

  const normalizedFoundationType =
    body.projectDetails?.foundationType?.trim().toLowerCase() ?? "";

  if (!applicableFoundationTypes.has(normalizedFoundationType)) {
    return NextResponse.json({
      item: "Column Foundations + Footings",
      quantityCum: 0,
      assumedSystem:
        body.projectDetails?.foundationType?.trim() ||
        "Foundation type not provided",
      materialCostPerCum: 0,
      labourCostPerCum: 0,
      equipmentCostPerCum: 0,
      assumptions:
        "This item is only applicable for Isolated Footing and Isolated Footing + Combined Footing projects. For the selected foundation type, this estimate is intentionally set to 0.",
      confidence: "high",
    });
  }

  const grossFloorAreaSqft = calculateGrossFloorAreaSqft({
    superstructureFootprint: body.projectDetails?.superstructureFootprint,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });
  const benchmarkContext = resolveEstimatingBenchmarkContext({
    lineItemCode: "A1012",
    projectType: body.estimate.projectType,
    foundationType: body.projectDetails?.foundationType,
    superstructureType: body.projectDetails?.superstructureType,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: ["footing", "foundation", "concrete", "rcc", "reinforcement", "formwork", "shuttering"],
    targetUnits: ["cu.m", "cum", "m3"],
  });
  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["cu.m", "cum", "m3"],
    targetUnitLabel: "INR per cu.m",
    itemName: "Column Foundations + Footings",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: ["footing", "foundation", "concrete", "rcc", "reinforcement", "formwork", "shuttering"],
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
      item: "Column Foundations + Footings",
      costCode: "A1012",
      unit: "cu.m",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      notes: [
        "Estimate only the concrete quantity in cu.m for column foundations and footings.",
        "Do not jump directly to total quantity. Start from benchmarkContext.finalRatioPerSqftGfa as the quantity benchmark and adjust only if the project inputs clearly justify it, then multiply that benchmark by GFA to get the final total quantity.",
        `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
        "If you derive any volume from footprint areas and assumed thicknesses or depths, convert sq.ft to sq.m first and convert any mm dimensions to meters before calculating cu.m.",
        "This item is applicable only when the project foundation type is Isolated Footing or Isolated Footing + Combined Footing.",
        "Material cost per cu.m must include concrete, reinforcing steel, formwork, cover blocks, and miscellaneous supporting consumables.",
        "Labour cost per cu.m must include steel binding, formwork setup, shuttering adjustments, concrete pouring, and related labour effort.",
        "Equipment cost per cu.m may include vibrator usage and any small foundation concreting equipment that is clearly applicable.",
        "Return practical conceptual costs in INR per cu.m.",
        "Assume Indian construction context.",
        ...buildBenchmarkPromptNotes(benchmarkContext),
        ...buildDsrPromptNotes("INR per cu.m"),
        ...buildPricingFallbackPromptNotes("INR per cu.m"),
        ...sharedUnitConsistencyNotes,
      ],
    },
    benchmarkContext,
    webPricingContext,
    dsrReferenceRates,
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
            "You are an experienced Indian construction estimator preparing a conceptual cost draft for Column Foundations + Footings. Use the project details, area takeoffs, finishes, and benchmarkContext to estimate a realistic concrete quantity in cu.m, and practical conceptual material, labour, and equipment costs in INR per cu.m. Do not estimate the total quantity directly. Start from benchmarkContext.finalRatioPerSqftGfa as the default quantity anchor, adjust it only when the project inputs clearly justify it, and then multiply that benchmark by GFA to get the final quantity. Material cost must include concrete, steel, formwork, cover blocks, and miscellaneous consumables. Labour cost must include steel binding, formwork setup, and concrete pouring labour. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "column_foundations_footings_cost_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              item: { type: "string" },
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
        },
      },
    }),
    });

    responseJson = (await openAiResponse.json()) as OpenAIChatCompletionResponse;
  } catch (error) {
    console.error(
      "Failed to read the OpenAI response for column foundations + footings draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating column foundations + footings draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating column foundations + footings draft.",
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
      quantityCum: number;
      assumedSystem: string;
      materialCostPerCum: number;
      labourCostPerCum: number;
      equipmentCostPerCum: number;
      assumptions: string;
      confidence: "low" | "medium" | "high";
    };

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      {
        error:
          "Failed to parse the AI column foundations + footings draft response.",
      },
      { status: 500 }
    );
  }
}





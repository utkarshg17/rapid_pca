import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import {
  buildBenchmarkPromptNotes,
  resolveEstimatingBenchmarkContext,
} from "@/app/api/job-estimates/shared-estimating-secrets";
import { buildDsrPromptNotes, fetchRelevantDsrRates } from "@/app/api/job-estimates/shared-dsr-rates";
import { buildPricingFallbackPromptNotes, buildWebPricingContext } from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type PlumbingPipeDraftRequestBody = {
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
    finishType?: string;
    description?: string;
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

  let body: PlumbingPipeDraftRequestBody;

  try {
    body = (await request.json()) as PlumbingPipeDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.areaTakeoffs) || body.areaTakeoffs.length === 0) {
    return NextResponse.json(
      {
        error:
          "Area takeoff rows are required for plumbing pipe estimation.",
      },
      { status: 400 }
    );
  }

  const grossFloorAreaSqft = calculateGrossFloorAreaSqft({
    superstructureFootprint: body.projectDetails?.superstructureFootprint,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });
  const benchmarkContext = resolveEstimatingBenchmarkContext({
    lineItemCode: "D2024",
    projectType: body.estimate.projectType,
    foundationType: body.projectDetails?.foundationType,
    superstructureType: body.projectDetails?.superstructureType,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
  });

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: ["plumbing pipe", "pipe", "cpvc", "upvc", "gi pipe", "water supply", "drainage pipe"],
    targetUnits: ["lf", "rft", "ft", "running ft", "running feet"],
  });
  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["lf", "rft", "ft", "running ft", "running feet"],
    targetUnitLabel: "INR per LF",
    itemName: "Plumbing Pipe",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: ["plumbing pipe", "pipe", "cpvc", "upvc", "gi pipe", "water supply", "drainage pipe"],
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
      item: "Plumbing Pipe",
      costCode: "D2024",
      unit: "LF",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      notes: [
        "Estimate the total plumbing pipe quantity in LF for the structure.",
        "Do not jump directly to total quantity. Start from benchmarkContext.finalRatioPerSqftGfa as the default LF-of-plumbing-pipe-per-sq.ft-of-GFA benchmark, adjust it only if the project inputs clearly justify it, and then multiply that benchmark by GFA to get the final total quantity.",
        `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
        "Explicitly interpret the benchmark ratio for D2024 as LF of plumbing pipe per sq.ft of GFA.",
        "This scope includes the plumbing piping network that runs through the structure.",
        "This scope excludes sanitary fixtures, taps, mixers, shower sets, WCs, basins, sinks, pumps, and other plumbing fixtures or equipment that belong in separate cost codes.",
        "Assume the piping runs through slabs, shafts, wet areas, and walls of the building where relevant.",
        "Material cost per LF should include pipes, fittings, bends, couplers, supports, and clearly necessary plumbing consumables for this scope.",
        "Labour cost per LF should include pipe laying, cutting, jointing, supports fixing, pressure-testing related effort where applicable, and associated plumbing labour for the piping scope.",
        "Equipment cost per LF may include threading tools, cutting tools, testing equipment, and other clearly applicable installation equipment. Use 0 when equipment is not meaningfully applicable.",
        "This line item depends primarily on wet area density, toilets, kitchens, shafts, and plumbing service intensity.",
        "Return practical conceptual costs in INR per LF.",
        "Assume Indian construction context.",
        ...buildBenchmarkPromptNotes(benchmarkContext),
        ...buildDsrPromptNotes("INR per LF"),
        ...buildPricingFallbackPromptNotes("INR per LF"),
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
            "You are an experienced Indian construction estimator preparing a conceptual cost draft for Plumbing Pipe. Use the project details, area takeoffs, finishes, and benchmarkContext to estimate a realistic plumbing pipe quantity in LF, and practical conceptual material, labour, and equipment costs in INR per LF. Do not estimate the total quantity directly. Start from benchmarkContext.finalRatioPerSqftGfa as the default LF-of-plumbing-pipe-per-sq.ft-of-GFA anchor, adjust it only when the project inputs clearly justify it, and then multiply that benchmark by GFA to get the final quantity. This scope includes the plumbing piping network only and excludes sanitary fixtures, taps, mixers, WCs, basins, sinks, pumps, and other fixtures or equipment. Plumbing Pipe depends primarily on wet area density, toilets, kitchens, shafts, and plumbing service intensity. In assumptions, explicitly state the selected base ratio, applied foundation multiplier, applied superstructure multiplier, final ratio, and final estimated quantity. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "plumbing_pipe_cost_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              item: { type: "string" },
              quantity: { type: "number" },
              unit: {
                type: "string",
                enum: ["LF"],
              },
              assumedSystem: { type: "string" },
              materialCostPerUnit: { type: "number" },
              labourCostPerUnit: { type: "number" },
              equipmentCostPerUnit: { type: "number" },
              assumptions: { type: "string" },
              confidence: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
            },
            required: [
              "item",
              "quantity",
              "unit",
              "assumedSystem",
              "materialCostPerUnit",
              "labourCostPerUnit",
              "equipmentCostPerUnit",
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
      "Failed to read the OpenAI response for plumbing pipe draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating plumbing pipe draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating plumbing pipe draft.",
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
      quantity: number;
      unit: "LF";
      assumedSystem: string;
      materialCostPerUnit: number;
      labourCostPerUnit: number;
      equipmentCostPerUnit: number;
      assumptions: string;
      confidence: "low" | "medium" | "high";
    };

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to parse the AI plumbing pipe draft response.",
      },
      { status: 500 }
    );
  }
}






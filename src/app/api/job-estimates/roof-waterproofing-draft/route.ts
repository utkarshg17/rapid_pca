import { NextResponse } from "next/server";

import {
  buildDsrPromptNotes,
  fetchRelevantDsrRates,
} from "@/app/api/job-estimates/shared-dsr-rates";
import {
  buildPricingFallbackPromptNotes,
  buildWebPricingContext,
} from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type RoofWaterproofingDraftRequestBody = {
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
  roofArea: {
    areaSqft: number;
    sourceLabel: string;
    description: string;
    matchedRows: Array<{
      roomType: string;
      areaSqft: number;
      floorFinish: string;
    }>;
  };
  areaTakeoffs: Array<{
    roomType: string;
    areaSqft: number;
    floorFinish: string;
  }>;
  openings: Array<{
    openingType: string;
    openingName: string;
    heightMm: number;
    widthMm: number;
    quantity: number;
    description: string;
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

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  let body: RoofWaterproofingDraftRequestBody;

  try {
    body = (await request.json()) as RoofWaterproofingDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.roofArea || body.roofArea.areaSqft <= 0) {
    return NextResponse.json(
      {
        error:
          "A terrace or roof area is required for roof waterproofing estimation.",
      },
      { status: 400 }
    );
  }

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: [
      "roof waterproofing",
      "terrace waterproofing",
      "waterproofing membrane",
      "APP membrane",
      "cementitious waterproofing",
      "brick bat coba",
      "liquid waterproofing",
    ],
    targetUnits: ["sq.ft", "sq.m"],
  });

  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["sq.ft", "sq.m"],
    targetUnitLabel: "INR per sq.ft",
    itemName: "Roof Waterproofing",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: [
      "roof waterproofing",
      "terrace waterproofing",
      "waterproofing membrane",
      "APP membrane",
      "cementitious waterproofing",
      "brick bat coba",
      "liquid waterproofing",
    ],
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
    },
    costingContext: {
      item: "Roof Waterproofing",
      costCode: "B3017",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      roofAreaSqft: body.roofArea.areaSqft,
      roofAreaSourceLabel: body.roofArea.sourceLabel,
      roofAreaDescription:
        body.roofArea.description.trim() ||
        "No explicit terrace or roof description was available, so assume a standard roof or terrace waterproofing system appropriate to the project location.",
      notes: [
        "Use the supplied roofAreaSqft as the quantity basis for this estimate. Do not re-estimate total area from GFA.",
        `Roof waterproofing quantity = ${body.roofArea.areaSqft.toFixed(2)} sq.ft.`,
        "Use the matched roof or terrace area-takeoff rows and any relevant finish or opening context to infer the most appropriate waterproofing build-up for this project.",
        "If no explicit terrace or roof description is available, assume a standard roof waterproofing system suited to the project type and location.",
        "Material cost per sq.ft should include the waterproofing treatment layers, primers, reinforcement or membrane where applicable, protection layer or screed where clearly required, and miscellaneous consumables.",
        "Labour cost per sq.ft should include surface preparation, primer application, membrane or coating application, joints and edge treatment, and related finishing labour.",
        "Equipment cost per sq.ft may include clearly applicable waterproofing tools or support equipment, but keep it modest if minimal equipment is typical.",
        "Return practical conceptual rates per sq.ft for material, labour, and equipment.",
        "Assume Indian construction context.",
        ...buildDsrPromptNotes("INR per sq.ft"),
        ...buildPricingFallbackPromptNotes("INR per sq.ft"),
        ...sharedUnitConsistencyNotes,
      ],
    },
    dsrReferenceRates,
    webPricingContext,
    roofArea: body.roofArea,
    areaTakeoffs: body.areaTakeoffs,
    openings: body.openings,
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
              "You are an experienced Indian construction estimator preparing a conceptual roof waterproofing cost draft for estimator review. Use the provided project details, area takeoffs, openings, finishes, and roof area basis. Do not estimate total quantity from scratch. Use the supplied roof area in sq.ft as the quantity, then estimate practical per-sq.ft material, labour, and equipment costs in INR. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
          },
          {
            role: "user",
            content: JSON.stringify(promptPayload),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "roof_waterproofing_cost_draft",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                item: { type: "string" },
                areaSqft: { type: "number" },
                assumedWaterproofingSystem: { type: "string" },
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
                "assumedWaterproofingSystem",
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
      "Failed to read the OpenAI response for roof waterproofing draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating roof waterproofing draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating roof waterproofing draft.",
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
      assumedWaterproofingSystem: string;
      materialCostPerSqft: number;
      labourCostPerSqft: number;
      equipmentCostPerSqft: number;
      assumptions: string;
      confidence: "low" | "medium" | "high";
    };

    return NextResponse.json({
      ...parsed,
      areaSqft: parsed.areaSqft > 0 ? parsed.areaSqft : body.roofArea.areaSqft,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse the AI roof waterproofing draft response." },
      { status: 500 }
    );
  }
}

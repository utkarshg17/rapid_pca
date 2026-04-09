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

type ClearingAndGrubbingDraftRequestBody = {
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
  siteArea: {
    areaSqft: number;
    sourceLabel: string;
    description: string;
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

  let body: ClearingAndGrubbingDraftRequestBody;

  try {
    body = (await request.json()) as ClearingAndGrubbingDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.siteArea || body.siteArea.areaSqft <= 0) {
    return NextResponse.json(
      {
        error:
          "A total plot area is required for clearing and grubbing estimation.",
      },
      { status: 400 }
    );
  }

  const dsrReferenceRates = await fetchRelevantDsrRates({
    searchTerms: [
      "clearing and grubbing",
      "site clearing",
      "site preparation",
      "land clearing",
      "debris removal",
      "brush clearing",
      "earthwork site clearance",
    ],
    targetUnits: ["sq.ft", "sq.m"],
  });

  const webPricingContext = await buildWebPricingContext({
    apiKey,
    dsrReferenceRates,
    targetUnits: ["sq.ft", "sq.m"],
    targetUnitLabel: "INR per sq.ft",
    itemName: "Clearing and Grubbing",
    projectName: body.estimate.projectName,
    projectType: body.estimate.projectType,
    location: {
      city: body.projectDetails?.city,
      state: body.projectDetails?.state,
      country: body.projectDetails?.country,
    },
    searchTerms: [
      "clearing and grubbing",
      "site clearing",
      "site preparation",
      "land clearing",
      "debris removal",
      "brush clearing",
      "earthwork site clearance",
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
      item: "Clearing and Grubbing",
      costCode: "G1011",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      siteAreaSqft: body.siteArea.areaSqft,
      siteAreaSourceLabel: body.siteArea.sourceLabel,
      siteAreaDescription:
        body.siteArea.description.trim() ||
        "Use the total plot area as the basis for clearing and grubbing and assume a standard construction-site readiness scope for the project location.",
      notes: [
        "Use the supplied siteAreaSqft as the quantity basis for this estimate. Do not re-estimate total area from GFA.",
        `Clearing and grubbing quantity = ${body.siteArea.areaSqft.toFixed(2)} sq.ft.`,
        "This scope is limited to clearing the plot and preparing it for mobilization and start of construction work.",
        "Assume the work includes generic site clearance, removal of vegetation or loose debris where applicable, basic cleaning, minor leveling support, and readiness for mobilization.",
        "Do not include permanent construction works, foundations, utilities, boundary walls, or major earthwork beyond what is clearly necessary for basic site preparation.",
        "Material cost per sq.ft should stay modest and only include clearly applicable consumables, disposal aids, marking materials, temporary barricading consumables, and similar minor inputs.",
        "Labour cost per sq.ft should include site clearing labour, brush or debris handling, collection, loading, and general preparation labour.",
        "Equipment cost per sq.ft may include clearly applicable small plant or equipment such as loader, tractor, tipper, brush cutter, or similar site-clearing support equipment, scaled sensibly for the location and project type.",
        "Return practical conceptual rates per sq.ft for material, labour, and equipment.",
        "Assume Indian construction context.",
        ...buildDsrPromptNotes("INR per sq.ft"),
        ...buildPricingFallbackPromptNotes("INR per sq.ft"),
        ...sharedUnitConsistencyNotes,
      ],
    },
    dsrReferenceRates,
    webPricingContext,
    siteArea: body.siteArea,
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
              "You are an experienced Indian construction estimator preparing a conceptual clearing and grubbing cost draft for estimator review. Use the provided project details, area takeoffs, openings, finishes, and site area basis. Do not estimate total quantity from scratch. Use the supplied site area in sq.ft as the quantity, then estimate practical per-sq.ft material, labour, and equipment costs in INR. Use the provided dsrReferenceRates as the primary pricing anchor and return only valid JSON matching the schema.",
          },
          {
            role: "user",
            content: JSON.stringify(promptPayload),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "clearing_and_grubbing_cost_draft",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                item: { type: "string" },
                areaSqft: { type: "number" },
                assumedSitePreparationScope: { type: "string" },
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
                "assumedSitePreparationScope",
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
      "Failed to read the OpenAI response for clearing and grubbing draft:",
      error
    );
    return NextResponse.json(
      {
        error:
          "OpenAI returned an unreadable response while generating clearing and grubbing draft.",
      },
      { status: 502 }
    );
  }

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating clearing and grubbing draft.",
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
      assumedSitePreparationScope: string;
      materialCostPerSqft: number;
      labourCostPerSqft: number;
      equipmentCostPerSqft: number;
      assumptions: string;
      confidence: "low" | "medium" | "high";
    };

    return NextResponse.json({
      ...parsed,
      areaSqft: parsed.areaSqft > 0 ? parsed.areaSqft : body.siteArea.areaSqft,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse the AI clearing and grubbing draft response." },
      { status: 500 }
    );
  }
}

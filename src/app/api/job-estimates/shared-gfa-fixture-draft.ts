import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import {
  buildDsrPromptNotes,
  fetchRelevantDsrRates,
} from "@/app/api/job-estimates/shared-dsr-rates";
import {
  buildPricingFallbackPromptNotes,
  buildWebPricingContext,
} from "@/app/api/job-estimates/shared-web-pricing";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type GfaFixtureDraftRequestBody = {
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
  grossFloorAreaSqft?: number;
  areaTakeoffs?: Array<{
    roomType: string;
    areaSqft: number;
    floorFinish: string;
  }>;
  finishes?: Array<{
    finishType?: string;
    description?: string;
  }>;
  openings?: Array<{
    openingType: string;
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

type GfaFixtureDraftConfig = {
  itemName: string;
  costCode: string;
  schemaName: string;
  searchTerms: string[];
  includedScope: string[];
  excludedScope: string[];
  materialScope: string;
  labourScope: string;
  equipmentScope: string;
};

const openAiUrl = "https://api.openai.com/v1/chat/completions";
const model = "gpt-5.4-nano";
const targetUnits = ["sq.ft", "sq.m", "each", "nos", "no", "point"];

export function createGfaFixtureDraftHandler(config: GfaFixtureDraftConfig) {
  return async function POST(request: Request) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    let body: GfaFixtureDraftRequestBody;

    try {
      body = (await request.json()) as GfaFixtureDraftRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const calculatedGrossFloorAreaSqft = calculateGrossFloorAreaSqft({
      superstructureFootprint: body.projectDetails?.superstructureFootprint,
      stiltFloorCount: body.projectDetails?.stiltFloorCount,
      floorCount: body.projectDetails?.floorCount,
    });
    const grossFloorAreaSqft =
      calculatedGrossFloorAreaSqft > 0
        ? calculatedGrossFloorAreaSqft
        : body.grossFloorAreaSqft ?? 0;

    if (grossFloorAreaSqft <= 0) {
      return NextResponse.json(
        {
          error:
            "Gross Floor Area is required before generating this fixture estimate.",
        },
        { status: 400 }
      );
    }

    const dsrReferenceRates = await fetchRelevantDsrRates({
      searchTerms: config.searchTerms,
      targetUnits,
    });
    const webPricingContext = await buildWebPricingContext({
      apiKey,
      dsrReferenceRates,
      targetUnits,
      targetUnitLabel: "INR per sq.ft of GFA",
      itemName: config.itemName,
      projectName: body.estimate.projectName,
      projectType: body.estimate.projectType,
      location: {
        city: body.projectDetails?.city,
        state: body.projectDetails?.state,
        country: body.projectDetails?.country,
      },
      searchTerms: config.searchTerms,
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
        superstructureFootprint:
          body.projectDetails?.superstructureFootprint ?? "",
        stiltFloorCount: body.projectDetails?.stiltFloorCount ?? "",
        floorCount: body.projectDetails?.floorCount ?? "",
        grossFloorAreaSqft,
      },
      costingContext: {
        item: config.itemName,
        costCode: config.costCode,
        unit: "sq.ft",
        currency: "INR",
        pricingBasis: "Conceptual estimate for bidding review",
        includedScope: config.includedScope,
        excludedScope: config.excludedScope,
        notes: [
          "Quantity/GFA is fixed at 1 for this item.",
          `Use quantity = GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft. Do not infer or alter quantity.`,
          "Only estimate the blended material, labour, and equipment costs per sq.ft of GFA.",
          "If DSR references are per fixture, point, or nos instead of per sq.ft, estimate a practical fixture or point density per GFA for this project type, convert it into INR per sq.ft of GFA, and briefly state that basis in assumptions.",
          config.materialScope,
          config.labourScope,
          config.equipmentScope,
          "Assume Indian construction context.",
          ...buildDsrPromptNotes("INR per sq.ft of GFA"),
          ...buildPricingFallbackPromptNotes("INR per sq.ft of GFA"),
          ...sharedUnitConsistencyNotes,
        ],
      },
      dsrReferenceRates,
      webPricingContext,
      areaTakeoffs: body.areaTakeoffs ?? [],
      finishInputs: body.finishes ?? [],
      openings: body.openings ?? [],
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
              content: [
                `You are an experienced Indian construction estimator preparing a conceptual cost draft for ${config.itemName}.`,
                "Use the project details, area takeoffs, finishes, openings, and provided DSR reference rates.",
                "The quantity is fixed at the project's Gross Floor Area, so Quantity/GFA must be 1 and quantity must equal GFA in sq.ft.",
                "Estimate only the blended material, labour, and equipment costs in INR per sq.ft of GFA.",
                "Use dsrReferenceRates as the primary pricing anchor. If DSR rows are per fixture, point, or nos, convert to a per-sq.ft-of-GFA rate using a practical fixture density assumption.",
                "Return only valid JSON matching the schema.",
              ].join(" "),
            },
            {
              role: "user",
              content: JSON.stringify(promptPayload),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: config.schemaName,
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  item: { type: "string" },
                  quantity: { type: "number" },
                  unit: {
                    type: "string",
                    enum: ["sq.ft"],
                  },
                  assumedSystem: { type: "string" },
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
                  "quantity",
                  "unit",
                  "assumedSystem",
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
        `Failed to read the OpenAI response for ${config.itemName} draft:`,
        error
      );
      return NextResponse.json(
        {
          error: `OpenAI returned an unreadable response while generating ${config.itemName} draft.`,
        },
        { status: 502 }
      );
    }

    if (!openAiResponse.ok) {
      return NextResponse.json(
        {
          error:
            responseJson.error?.message ??
            `OpenAI request failed while generating ${config.itemName} draft.`,
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
        unit: "sq.ft";
        assumedSystem: string;
        materialCostPerSqft: number;
        labourCostPerSqft: number;
        equipmentCostPerSqft: number;
        assumptions: string;
        confidence: "low" | "medium" | "high";
      };

      return NextResponse.json({
        ...parsed,
        item: config.itemName,
        quantity: grossFloorAreaSqft,
        unit: "sq.ft" as const,
      });
    } catch {
      return NextResponse.json(
        { error: `Failed to parse the AI ${config.itemName} draft response.` },
        { status: 500 }
      );
    }
  };
}

import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";

type DesignServiceDraftRequestBody = {
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

type DesignServiceDraftConfig = {
  itemName: string;
  costCode: string;
  schemaName: string;
  serviceDescription: string;
  pricingQuestion: string;
};

const openAiUrl = "https://api.openai.com/v1/chat/completions";
const model = "gpt-5.4-nano";

export function createDesignServiceDraftHandler(config: DesignServiceDraftConfig) {
  return async function POST(request: Request) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    let body: DesignServiceDraftRequestBody;

    try {
      body = (await request.json()) as DesignServiceDraftRequestBody;
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
        { error: "Gross Floor Area is required before generating this design service estimate." },
        { status: 400 }
      );
    }

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
        item: config.itemName,
        costCode: config.costCode,
        unit: "sq.ft",
        currency: "INR",
        pricingBasis: "Conceptual professional service fee estimate for bidding review",
        serviceDescription: config.serviceDescription,
        notes: [
          "Quantity/GFA is fixed at 1 for this professional service item.",
          `Use quantity = GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft. Do not infer or alter quantity.`,
          "Material cost per sq.ft must be 0 for this item.",
          "Equipment cost per sq.ft must be 0 for this item.",
          "Only estimate the labour/design service fee rate in INR per sq.ft of GFA.",
          config.pricingQuestion,
          "Use the full project context to adjust the design service rate for project type, structure type, floor count, basement complexity, finishes, openings, and region.",
          "Assume Indian construction and professional-services context.",
        ],
      },
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
                `You are an experienced Indian construction estimator estimating ${config.itemName} fees for a building project.`,
                "Use project details, area takeoffs, finishes, and openings as context.",
                "Quantity is fixed at GFA, Quantity/GFA is 1, material cost is 0, and equipment cost is 0.",
                "Estimate only the labour/design service fee rate in INR per sq.ft of GFA.",
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
                  labourCostPerSqft: { type: "number" },
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
                  "labourCostPerSqft",
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
        { error: `OpenAI returned an unreadable response while generating ${config.itemName} draft.` },
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
        labourCostPerSqft: number;
        assumptions: string;
        confidence: "low" | "medium" | "high";
      };

      return NextResponse.json({
        ...parsed,
        item: config.itemName,
        quantity: grossFloorAreaSqft,
        unit: "sq.ft" as const,
        materialCostPerSqft: 0,
        equipmentCostPerSqft: 0,
      });
    } catch {
      return NextResponse.json(
        { error: `Failed to parse the AI ${config.itemName} draft response.` },
        { status: 500 }
      );
    }
  };
}

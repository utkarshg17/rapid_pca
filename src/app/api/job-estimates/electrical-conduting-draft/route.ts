import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type ElectricalCondutingDraftRequestBody = {
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
const model = "gpt-5.4";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 }
    );
  }

  let body: ElectricalCondutingDraftRequestBody;

  try {
    body = (await request.json()) as ElectricalCondutingDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.areaTakeoffs) || body.areaTakeoffs.length === 0) {
    return NextResponse.json(
      {
        error:
          "Area takeoff rows are required for electrical conduting estimation.",
      },
      { status: 400 }
    );
  }

  const grossFloorAreaSqft = calculateGrossFloorAreaSqft({
    superstructureFootprint: body.projectDetails?.superstructureFootprint,
    stiltFloorCount: body.projectDetails?.stiltFloorCount,
    floorCount: body.projectDetails?.floorCount,
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
      item: "Electrical Conduting",
      costCode: "D5013",
      unit: "LF",
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      notes: [
        "Estimate the total electrical conduting quantity in LF for the structure.",
        "Do not jump directly to total quantity. First estimate the most appropriate benchmark LF per sq.ft of GFA for this type of project and floor range, then multiply that benchmark by GFA to get the final total quantity.",
        `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
        "This scope includes conduiting pipe, the actual wiring, and distribution boxes for the structure.",
        "This scope excludes switches, sockets, plugs, light fixtures, fans, decorative fixtures, and other electrical accessories that belong in separate cost codes.",
        "Assume the conduiting runs through slabs and walls of the building.",
        "Material cost per LF should include conduiting pipe, wiring, distribution boxes, and clearly necessary miscellaneous electrical consumables for this scope.",
        "Labour cost per LF should include chasing or placement effort where relevant, pipe laying, wire pulling, box fixing, and associated electrical labour for the conduting scope.",
        "Equipment cost per LF may include small tools and clearly applicable installation equipment. Use 0 when equipment is not meaningfully applicable.",
        "Return practical conceptual costs in INR per LF.",
        "Assume Indian construction context.",
        ...sharedUnitConsistencyNotes,
      ],
    },
    areaTakeoffs: body.areaTakeoffs,
    finishInputs: body.allFinishes ?? [],
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
            "You are an experienced Indian construction estimator preparing a conceptual cost draft for Electrical Conduting. Use the project details, area takeoffs, and finishes to estimate a realistic electrical conduting quantity in LF, and practical conceptual material, labour, and equipment costs in INR per LF. Do not estimate the total quantity directly. First infer the most appropriate LF per sq.ft of GFA benchmark for this type of project and floor range, then multiply that benchmark by GFA to get the final quantity. This scope includes conduiting pipe, the actual wiring, and distribution boxes, but excludes switches, plugs, sockets, and fixtures. Return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "electrical_conduting_cost_draft",
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

  const responseJson = (await openAiResponse.json()) as OpenAIChatCompletionResponse;

  if (!openAiResponse.ok) {
    return NextResponse.json(
      {
        error:
          responseJson.error?.message ??
          "OpenAI request failed while generating electrical conduting draft.",
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
        error: "Failed to parse the AI electrical conduting draft response.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import { calculateGrossFloorAreaSqft } from "@/app/api/job-estimates/shared-estimate-benchmark";
import { sharedUnitConsistencyNotes } from "@/app/api/job-estimates/shared-unit-consistency";

type UpperFloorsConstructionDraftRequestBody = {
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

  let body: UpperFloorsConstructionDraftRequestBody;

  try {
    body = (await request.json()) as UpperFloorsConstructionDraftRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.areaTakeoffs) || body.areaTakeoffs.length === 0) {
    return NextResponse.json(
      {
        error:
          "Area takeoff rows are required for upper floors construction estimation.",
      },
      { status: 400 }
    );
  }

  const superstructureType = body.projectDetails?.superstructureType?.trim() || "";
  const normalizedSuperstructureType = superstructureType.toLowerCase();
  const isSteelStructure = normalizedSuperstructureType === "steel";
  const unit = isSteelStructure ? "ton" : "cu.m";
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
      superstructureType: superstructureType || "RCC Moment Frame",
      totalPlotArea: body.projectDetails?.totalPlotArea ?? "",
      basementCount: body.projectDetails?.basementCount ?? "",
      basementArea: body.projectDetails?.basementArea ?? "",
      superstructureFootprint: body.projectDetails?.superstructureFootprint ?? "",
      stiltFloorCount: body.projectDetails?.stiltFloorCount ?? "",
      floorCount: body.projectDetails?.floorCount ?? "",
      grossFloorAreaSqft,
    },
    costingContext: {
      item: "Upper Floors Construction (Slab + Beam)",
      costCode: "B1012",
      unit,
      currency: "INR",
      pricingBasis: "Conceptual estimate for bidding review",
      notes: isSteelStructure
        ? [
            "The project superstructure type is Steel, so estimate the quantity in ton, not concrete volume.",
            "Do not jump directly to total quantity. First estimate a practical benchmark unit quantity in ton per sq.ft of GFA based on project type, floor range, and structural system, then multiply that benchmark by GFA to get the final total quantity.",
            `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
            "Material cost per ton should primarily include structural steel members relevant to upper floor framing and deck support, plus clearly necessary steel components.",
            "Labour cost per ton should include fabrication, erection, welding or bolting support, and related structural steel labour.",
            "Equipment cost per ton should include the equipment typically required for steel upper-floor structural work where clearly applicable.",
            "Return practical conceptual costs in INR per ton.",
            "Assume Indian construction context.",
            ...sharedUnitConsistencyNotes,
          ]
        : [
            "The project superstructure type is RCC-based, so estimate the quantity in cu.m of concrete for upper floors construction including slabs and beams.",
            "Do not jump directly to total quantity. First estimate a practical benchmark unit quantity in cu.m per sq.ft of GFA based on project type, floor range, and structural system, then multiply that benchmark by GFA to get the final total quantity.",
            `Use GFA = ${grossFloorAreaSqft.toFixed(2)} sq.ft, calculated as superstructure footprint x (stilt floor count + floor count).`,
            "If you infer slab or beam thickness in mm, first convert all source areas from sq.ft to sq.m, then convert thickness from mm to meters, and only then calculate volume in cu.m.",
            "Material cost per cu.m must include concrete, reinforcing steel, formwork, cover blocks, binding wire, and miscellaneous supporting consumables.",
            "Labour cost per cu.m must include rebar labour, formwork labour, concrete pouring labour, and related effort for slabs and beams.",
            "Equipment cost per cu.m may include needle vibrator and any other clearly applicable RCC structural equipment.",
            "Return practical conceptual costs in INR per cu.m.",
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
          content: isSteelStructure
            ? "You are an experienced Indian construction estimator preparing a conceptual cost draft for Upper Floors Construction (Slab + Beam) in a steel structure. Use the project details, area takeoffs, and finishes to estimate a realistic steel quantity in ton, and practical conceptual material, labour, and equipment costs in INR per ton. Do not estimate the total quantity directly. First infer a realistic benchmark ton per sq.ft of GFA for this type of project and floor range, then multiply that benchmark by GFA to get the final quantity. Material cost should primarily cover structural steel and necessary steel framing components. Labour cost should cover fabrication and erection labour. Return only valid JSON matching the schema."
            : "You are an experienced Indian construction estimator preparing a conceptual cost draft for Upper Floors Construction (Slab + Beam) in an RCC structure. Use the project details, area takeoffs, and finishes to estimate a realistic concrete quantity in cu.m, and practical conceptual material, labour, and equipment costs in INR per cu.m. Do not estimate the total quantity directly. First infer a realistic benchmark cu.m per sq.ft of GFA for this type of project and floor range, then multiply that benchmark by GFA to get the final quantity. Material cost must include concrete, steel, formwork, cover blocks, binding wire, and miscellaneous consumables. Labour cost must include rebar, formwork, and concrete pouring labour for slabs and beams. Return only valid JSON matching the schema.",
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "upper_floors_construction_cost_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              item: { type: "string" },
              quantity: { type: "number" },
              unit: {
                type: "string",
                enum: ["cu.m", "ton"],
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
          "OpenAI request failed while generating upper floors construction draft.",
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
      unit: "cu.m" | "ton";
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
        error:
          "Failed to parse the AI upper floors construction draft response.",
      },
      { status: 500 }
    );
  }
}


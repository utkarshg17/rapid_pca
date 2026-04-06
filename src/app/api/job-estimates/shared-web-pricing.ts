import type { DsrRateReference } from "@/app/api/job-estimates/shared-dsr-rates";

type LocationInput = {
  city?: string;
  state?: string;
  country?: string;
};

type BuildWebPricingContextInput = {
  apiKey: string;
  dsrReferenceRates: DsrRateReference[];
  targetUnits: string[];
  targetUnitLabel: string;
  itemName: string;
  projectName: string;
  projectType: string;
  location?: LocationInput;
  searchTerms: string[];
};

type WebPricingSource = {
  title: string;
  url: string;
};

export type WebPricingContext = {
  used: boolean;
  summary: string;
  sources: WebPricingSource[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    action?: {
      sources?: Array<{
        title?: string;
        url?: string;
      }>;
    };
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const responsesApiUrl = "https://api.openai.com/v1/responses";
const emptyWebPricingContext: WebPricingContext = {
  used: false,
  summary: "",
  sources: [],
};

export function buildPricingFallbackPromptNotes(targetUnitLabel: string) {
  return [
    "Use dsrReferenceRates first as the primary pricing anchor whenever they contain a close and unit-compatible match.",
    "If dsrReferenceRates are sparse, mismatched, or weak for this scope, use webPricingContext next as a secondary pricing anchor.",
    `If both dsrReferenceRates and webPricingContext are still thin for ${targetUnitLabel}, fall back to your own best professional judgment.`,
    "Whenever webPricingContext or your own judgment materially influences the final rates, say that briefly in assumptions.",
  ];
}

export async function buildWebPricingContext({
  apiKey,
  dsrReferenceRates,
  targetUnits,
  targetUnitLabel,
  itemName,
  projectName,
  projectType,
  location,
  searchTerms,
}: BuildWebPricingContextInput): Promise<WebPricingContext> {
  if (!shouldUseWebPricingFallback(dsrReferenceRates, targetUnits)) {
    return emptyWebPricingContext;
  }

  try {
    return (
      (await fetchSupplementalWebPricing({
        apiKey,
        itemName,
        projectName,
        projectType,
        targetUnitLabel,
        location,
        searchTerms,
      })) ?? emptyWebPricingContext
    );
  } catch (error) {
    console.error("Error fetching supplemental web pricing context:", error);
    return emptyWebPricingContext;
  }
}

function shouldUseWebPricingFallback(
  dsrReferenceRates: DsrRateReference[],
  targetUnits: string[]
) {
  const normalizedTargetUnits = new Set(targetUnits.map(normalizeUnit));
  const matchingUnitRows = dsrReferenceRates.filter((rate) =>
    normalizedTargetUnits.has(normalizeUnit(rate.unit))
  );

  return matchingUnitRows.length < 2;
}

async function fetchSupplementalWebPricing({
  apiKey,
  itemName,
  projectName,
  projectType,
  targetUnitLabel,
  location,
  searchTerms,
}: {
  apiKey: string;
  itemName: string;
  projectName: string;
  projectType: string;
  targetUnitLabel: string;
  location?: LocationInput;
  searchTerms: string[];
}): Promise<WebPricingContext | null> {
  const userLocation = buildApproximateUserLocation(location);

  const response = await fetch(responsesApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-nano",
      reasoning: {
        effort: "low",
      },
      tools: [
        {
          type: "web_search",
          ...(userLocation ? { user_location: userLocation } : {}),
        },
      ],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      input: [
        {
          role: "system",
          content:
            "You are grounding a construction cost estimate with public web references. Search the web for reliable Indian construction pricing references relevant to the requested item and target unit. Prefer public schedules of rates, tender schedules, vendor catalogs, and contractor pricing references. Return only valid JSON matching the schema. If you cannot find anything meaningfully relevant, set wasHelpful to false and leave summary empty.",
        },
        {
          role: "user",
          content: JSON.stringify({
            item: itemName,
            projectName,
            projectType,
            location,
            targetUnit: targetUnitLabel,
            searchTerms,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "web_pricing_context",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              wasHelpful: {
                type: "boolean",
              },
              summary: {
                type: "string",
              },
            },
            required: ["wasHelpful", "summary"],
          },
        },
      },
    }),
  });

  const responseJson = (await response.json()) as ResponsesApiResponse;

  if (!response.ok) {
    console.error(
      "OpenAI web pricing fallback request failed:",
      responseJson.error?.message ?? "Unknown error"
    );
    return null;
  }

  const outputText = extractOutputText(responseJson);

  if (!outputText) {
    return null;
  }

  try {
    const parsed = JSON.parse(outputText) as {
      wasHelpful: boolean;
      summary: string;
    };

    if (!parsed.wasHelpful || !parsed.summary.trim()) {
      return emptyWebPricingContext;
    }

    return {
      used: true,
      summary: parsed.summary.trim(),
      sources: extractWebSources(responseJson),
    };
  } catch (error) {
    console.error("Failed to parse supplemental web pricing context:", error);
    return null;
  }
}

function extractOutputText(responseJson: ResponsesApiResponse) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text;
  }

  const messageText = responseJson.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === "output_text" && typeof content.text === "string")
    ?.text;

  return messageText?.trim() ?? "";
}

function extractWebSources(responseJson: ResponsesApiResponse): WebPricingSource[] {
  const sources = responseJson.output
    ?.filter((item) => item.type === "web_search_call")
    .flatMap((item) => item.action?.sources ?? [])
    .map((source) => ({
      title: source.title?.trim() ?? "",
      url: source.url?.trim() ?? "",
    }))
    .filter((source) => source.title && source.url) ?? [];

  const uniqueSources = new Map<string, WebPricingSource>();

  for (const source of sources) {
    if (!uniqueSources.has(source.url)) {
      uniqueSources.set(source.url, source);
    }
  }

  return Array.from(uniqueSources.values()).slice(0, 5);
}

function buildApproximateUserLocation(location?: LocationInput) {
  const city = location?.city?.trim();
  const region = location?.state?.trim();
  const country = normalizeCountryCode(location?.country);

  if (!city && !region && !country) {
    return null;
  }

  return {
    type: "approximate" as const,
    ...(city ? { city } : {}),
    ...(region ? { region } : {}),
    ...(country ? { country } : {}),
  };
}

function normalizeCountryCode(country?: string) {
  const value = country?.trim().toLowerCase();

  if (!value) {
    return undefined;
  }

  if (value.length === 2) {
    return value.toUpperCase();
  }

  if (value === "india") {
    return "IN";
  }

  if (value === "united states" || value === "usa" || value === "us") {
    return "US";
  }

  return undefined;
}

function normalizeUnit(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9./]+/g, "");
}


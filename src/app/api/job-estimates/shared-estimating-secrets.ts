import estimatingSecretsJson from "../../../../job_estimating_secrets.json";

type SupportedLineItemCode =
  | "A1012"
  | "B1012"
  | "B1017"
  | "B2016"
  | "B2018"
  | "C1018"
  | "C3014"
  | "C3015"
  | "D2024"
  | "D5013";

type BuildingTypeKey =
  | "residential_high_rise_12_plus_storeys"
  | "residential_medium_rise_7_to_12_storeys"
  | "residential_low_rise_1_to_6_storeys"
  | "commercial_building"
  | "industrial_building"
  | "school_building"
  | "hospital";

type FoundationTypeKey =
  | "isolated_footings"
  | "raft"
  | "raft_plus_isolated_footings"
  | "isolated_footing_plus_combined_footing"
  | "raft_plus_pile";

type SuperstructureTypeKey =
  | "rcc_moment_frame"
  | "rcc_shear_walls"
  | "steel";

type LineItemDefinition = {
  code: SupportedLineItemCode;
  name: string;
  unit: string;
};

type LineItemSpecificRule = {
  code: SupportedLineItemCode;
  name: string;
  rule_text: string;
};

type EstimatingSecrets = {
  name: string;
  version: string;
  units_reference: Record<string, string>;
  supported_line_items: LineItemDefinition[];
  core_formula: {
    formula_text: string;
    gfa_unit: string;
  };
  default_assumptions: {
    base_case: string;
    missing_data_behavior: string;
    max_deviation_without_clear_reason: number;
  };
  line_item_specific_rules: Record<
    SupportedLineItemCode,
    LineItemSpecificRule
  >;
  benchmark_rules: string[];
  building_type_base_ratios: Record<
    BuildingTypeKey,
    {
      label: string;
      ratios_per_sqft_gfa: Record<SupportedLineItemCode, number>;
    }
  >;
  foundation_type_multipliers: Record<
    FoundationTypeKey,
    {
      label: string;
      multipliers: Record<SupportedLineItemCode, number>;
    }
  >;
  superstructure_type_multipliers: Record<
    SuperstructureTypeKey,
    {
      label: string;
      multipliers: Record<SupportedLineItemCode, number>;
      special_note?: string;
    }
  >;
};

export type EstimatingBenchmarkContext = {
  libraryName: string;
  libraryVersion: string;
  lineItemCode: SupportedLineItemCode;
  lineItemName: string;
  benchmarkUnit: string;
  gfaInputUnit: string;
  estimatedStoreys: number;
  buildingTypeKey: BuildingTypeKey;
  buildingTypeLabel: string;
  foundationTypeKey: FoundationTypeKey;
  foundationTypeLabel: string;
  superstructureTypeKey: SuperstructureTypeKey;
  superstructureTypeLabel: string;
  selectedBaseRatioPerSqftGfa: number;
  appliedFoundationMultiplier: number;
  appliedSuperstructureMultiplier: number;
  finalRatioPerSqftGfa: number;
  formulaText: string;
  maxDeviationWithoutClearReason: number;
  defaultAssumptions: {
    baseCase: string;
    missingDataBehavior: string;
  };
  lineItemSpecificRuleText: string;
  benchmarkRules: string[];
  usageNote?: string;
};

type ResolveEstimatingBenchmarkContextInput = {
  lineItemCode: SupportedLineItemCode;
  projectType?: string;
  foundationType?: string;
  superstructureType?: string;
  stiltFloorCount?: string;
  floorCount?: string;
};

const estimatingSecrets = estimatingSecretsJson as EstimatingSecrets;

export function resolveEstimatingBenchmarkContext({
  lineItemCode,
  projectType,
  foundationType,
  superstructureType,
  stiltFloorCount,
  floorCount,
}: ResolveEstimatingBenchmarkContextInput): EstimatingBenchmarkContext {
  const estimatedStoreys = Math.max(
    1,
    parseOptionalNumber(stiltFloorCount) + parseOptionalNumber(floorCount)
  );
  const buildingTypeKey = selectBuildingTypeKey(projectType, estimatedStoreys);
  const foundationTypeKey = selectFoundationTypeKey(foundationType);
  const superstructureTypeKey = selectSuperstructureTypeKey(superstructureType);

  const lineItemDefinition = estimatingSecrets.supported_line_items.find(
    (item) => item.code === lineItemCode
  );

  if (!lineItemDefinition) {
    throw new Error(`Unsupported estimating benchmark line item: ${lineItemCode}`);
  }

  const buildingType =
    estimatingSecrets.building_type_base_ratios[buildingTypeKey];
  const foundationTypeDefinition =
    estimatingSecrets.foundation_type_multipliers[foundationTypeKey];
  const superstructureTypeDefinition =
    estimatingSecrets.superstructure_type_multipliers[superstructureTypeKey];

  const selectedBaseRatioPerSqftGfa =
    buildingType.ratios_per_sqft_gfa[lineItemCode];
  const appliedFoundationMultiplier =
    foundationTypeDefinition.multipliers[lineItemCode];
  const appliedSuperstructureMultiplier =
    superstructureTypeDefinition.multipliers[lineItemCode];
  const finalRatioPerSqftGfa =
    selectedBaseRatioPerSqftGfa *
    appliedFoundationMultiplier *
    appliedSuperstructureMultiplier;

  return {
    libraryName: estimatingSecrets.name,
    libraryVersion: estimatingSecrets.version,
    lineItemCode,
    lineItemName: lineItemDefinition.name,
    benchmarkUnit:
      estimatingSecrets.units_reference[lineItemCode] ?? lineItemDefinition.unit,
    gfaInputUnit: estimatingSecrets.units_reference.gfa_input_unit,
    estimatedStoreys,
    buildingTypeKey,
    buildingTypeLabel: buildingType.label,
    foundationTypeKey,
    foundationTypeLabel: foundationTypeDefinition.label,
    superstructureTypeKey,
    superstructureTypeLabel: superstructureTypeDefinition.label,
    selectedBaseRatioPerSqftGfa,
    appliedFoundationMultiplier,
    appliedSuperstructureMultiplier,
    finalRatioPerSqftGfa,
    formulaText: estimatingSecrets.core_formula.formula_text,
    maxDeviationWithoutClearReason:
      estimatingSecrets.default_assumptions.max_deviation_without_clear_reason,
    defaultAssumptions: {
      baseCase: estimatingSecrets.default_assumptions.base_case,
      missingDataBehavior:
        estimatingSecrets.default_assumptions.missing_data_behavior,
    },
    lineItemSpecificRuleText:
      estimatingSecrets.line_item_specific_rules[lineItemCode].rule_text,
    benchmarkRules: buildRelevantBenchmarkRules(
      lineItemCode,
      buildingTypeKey,
      superstructureTypeKey
    ),
    usageNote: buildUsageNote(lineItemCode, superstructureTypeKey),
  };
}

export function buildBenchmarkPromptNotes(
  benchmarkContext: EstimatingBenchmarkContext
) {
  const maxDeviationPercent = Math.round(
    benchmarkContext.maxDeviationWithoutClearReason * 100
  );

  return [
    `Use benchmarkContext.finalRatioPerSqftGfa as your default quantity-per-GFA anchor for ${benchmarkContext.lineItemCode}.`,
    `benchmarkContext was selected using building type ${benchmarkContext.buildingTypeLabel}, foundation type ${benchmarkContext.foundationTypeLabel}, and superstructure type ${benchmarkContext.superstructureTypeLabel}.`,
    `Interpret benchmarkContext.finalRatioPerSqftGfa as ${benchmarkContext.benchmarkUnit} per ${benchmarkContext.gfaInputUnit}.`,
    `Benchmark math: ${benchmarkContext.selectedBaseRatioPerSqftGfa} x ${benchmarkContext.appliedFoundationMultiplier} x ${benchmarkContext.appliedSuperstructureMultiplier} = ${benchmarkContext.finalRatioPerSqftGfa} ${benchmarkContext.benchmarkUnit} per ${benchmarkContext.gfaInputUnit}.`,
    `Line-item rule: ${benchmarkContext.lineItemSpecificRuleText}`,
    `Do not deviate from benchmarkContext.finalRatioPerSqftGfa by more than ${maxDeviationPercent}% unless the project inputs clearly justify it.`,
    "If you deviate from benchmarkContext.finalRatioPerSqftGfa, explain the reason briefly in assumptions.",
    "In assumptions, explicitly state the selected base ratio, applied foundation multiplier, applied superstructure multiplier, final ratio, and final estimated quantity.",
    ...(benchmarkContext.usageNote ? [benchmarkContext.usageNote] : []),
  ];
}

function selectBuildingTypeKey(
  projectType: string | undefined,
  estimatedStoreys: number
): BuildingTypeKey {
  const normalizedProjectType = normalizeValue(projectType);

  if (includesAny(normalizedProjectType, ["hospital", "clinic", "medical", "healthcare"])) {
    return "hospital";
  }

  if (
    includesAny(normalizedProjectType, [
      "school",
      "education",
      "college",
      "university",
      "institution",
      "campus",
    ])
  ) {
    return "school_building";
  }

  if (
    includesAny(normalizedProjectType, [
      "industrial",
      "factory",
      "warehouse",
      "manufacturing",
      "plant",
      "workshop",
    ])
  ) {
    return "industrial_building";
  }

  if (
    includesAny(normalizedProjectType, [
      "commercial",
      "office",
      "retail",
      "mall",
      "hotel",
      "hospitality",
      "shop",
      "corporate",
    ])
  ) {
    return "commercial_building";
  }

  if (estimatedStoreys >= 12) {
    return "residential_high_rise_12_plus_storeys";
  }

  if (estimatedStoreys >= 7) {
    return "residential_medium_rise_7_to_12_storeys";
  }

  return "residential_low_rise_1_to_6_storeys";
}

function selectFoundationTypeKey(
  foundationType: string | undefined
): FoundationTypeKey {
  const normalizedFoundationType = normalizeValue(foundationType);

  if (normalizedFoundationType.includes("raft + pile")) {
    return "raft_plus_pile";
  }

  if (normalizedFoundationType.includes("raft + isolated footing")) {
    return "raft_plus_isolated_footings";
  }

  if (normalizedFoundationType.includes("isolated footing + combined footing")) {
    return "isolated_footing_plus_combined_footing";
  }

  if (normalizedFoundationType.includes("raft")) {
    return "raft";
  }

  if (normalizedFoundationType.includes("isolated footing")) {
    return "isolated_footings";
  }

  return "isolated_footings";
}

function selectSuperstructureTypeKey(
  superstructureType: string | undefined
): SuperstructureTypeKey {
  const normalizedSuperstructureType = normalizeValue(superstructureType);

  if (normalizedSuperstructureType.includes("steel")) {
    return "steel";
  }

  if (normalizedSuperstructureType.includes("shear wall")) {
    return "rcc_shear_walls";
  }

  return "rcc_moment_frame";
}

function buildRelevantBenchmarkRules(
  lineItemCode: SupportedLineItemCode,
  buildingTypeKey: BuildingTypeKey,
  superstructureTypeKey: SuperstructureTypeKey
) {
  const rules: string[] = [];

  const globalRules = estimatingSecrets.benchmark_rules;

  if (lineItemCode === "A1012") {
    rules.push(globalRules[0]);
  }

  if (lineItemCode === "B1012" || lineItemCode === "B1017") {
    rules.push(globalRules[1]);
  }

  if (lineItemCode === "B2016" || lineItemCode === "B2018") {
    rules.push(globalRules[2]);
    rules.push(globalRules[10]);
  }

  if (
    lineItemCode === "C1018" ||
    lineItemCode === "C3014" ||
    lineItemCode === "C3015"
  ) {
    rules.push(globalRules[3]);
    rules.push(globalRules[11]);
  }

  if (lineItemCode === "D2024") {
    rules.push(globalRules[6]);
    rules.push(globalRules[8]);
    rules.push(globalRules[12]);
  }

  if (lineItemCode === "D5013") {
    rules.push(globalRules[7]);
    rules.push(globalRules[9]);
    rules.push(globalRules[12]);
  }

  if (buildingTypeKey === "hospital") {
    rules.push(globalRules[4]);
  }

  if (buildingTypeKey === "industrial_building") {
    rules.push(globalRules[5]);
  }

  if (
    superstructureTypeKey === "steel" &&
    (lineItemCode === "C1018" ||
      lineItemCode === "C3014" ||
      lineItemCode === "C3015")
  ) {
    rules.push(
      "For steel structures, only increase these benchmark ratios if the project explicitly indicates dense masonry or conventional internal partitions."
    );
  }

  rules.push(globalRules[13]);

  return rules;
}

function buildUsageNote(
  lineItemCode: SupportedLineItemCode,
  superstructureTypeKey: SuperstructureTypeKey
) {
  if (
    superstructureTypeKey === "steel" &&
    (lineItemCode === "B1012" || lineItemCode === "B1017")
  ) {
    return "The benchmark library stores RCC-style structural intensity for this cost code. For steel structures, use the benchmark as an intensity anchor and convert it into a realistic ton-based final quantity.";
  }

  if (lineItemCode === "D2024") {
    return "For D2024, interpret benchmarkContext.finalRatioPerSqftGfa as LF of plumbing pipe per sq.ft of GFA. If the prompt does not provide extra wet-area or plumbing complexity, use the benchmark directly.";
  }

  if (lineItemCode === "D5013") {
    return "For D5013, interpret benchmarkContext.finalRatioPerSqftGfa as LF of conduiting per sq.ft of GFA. If the prompt does not provide extra electrical or routing complexity, use the benchmark directly.";
  }

  return undefined;
}

function includesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function normalizeValue(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseOptionalNumber(value?: string) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

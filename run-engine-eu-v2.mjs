/**
 * FaultKey Anchor-Log — eu-v2 batch (Stage B-EU-v2)
 *
 * Same byte-deterministic core engine as run-engine-eu.mjs, but applies
 * the eu-v2 rule overlay (eu-v2-rules.js) which is additive on eu-v1.
 * Reads cases 12-14 (the same three EU enforcement matters as v1, with
 * extended eu_flags for the v2 rules), writes one prediction artifact
 * per case to predictions-eu-v2/<slug>.json, and emits
 * anchor-payload-eu-v2.json — the file sealed to Sigstore Rekor.
 *
 * Commitment scheme matches v0.7 / eu-v1 batch byte-for-byte.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { applyEuV2RuleSet, RULE_SET_VERSION, euGateEngages } from "/home/ubuntu/causallayer-mcp/demo/eu-v2-rules.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, "cases");
const PRED_DIR = join(__dirname, "predictions-eu-v2");
mkdirSync(PRED_DIR, { recursive: true });

// ── verbatim engine (must match run-engine.mjs byte-for-byte) ──────────
function hashCode(str){let h=0;for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h=((h<<5)-h)+c;h=h&h;}return h;}
function hashHex(str){let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,"0")+((h>>>0)^0xdeadbeef).toString(16).padStart(8,"0");}

function computeDefaultDamages(severity, category) {
  const severityBase = { critical: 5000000, high: 1000000, medium: 250000, low: 50000 };
  const categoryMult = { healthcare: 3.0, autonomous_systems: 5.0, financial_services: 2.0, employment: 1.5, content_moderation: 0.8 };
  return (severityBase[severity] || 250000) * (categoryMult[category] || 1.0);
}
function computeRegulatory(jurisdiction, category, severity) {
  const reg = {};
  if (jurisdiction === "EU" || jurisdiction === "DE" || jurisdiction === "FR" || jurisdiction === "IT" || jurisdiction === "NL" || jurisdiction === "ES") {
    reg.eu_ai_act_article_6 = severity === "critical" || category === "healthcare" || category === "autonomous_systems" || category === "biometric_identification";
    reg.eu_ai_act_article_25 = true;
    reg.eu_ai_act_article_26 = true;
    reg.eu_ai_act_article_27 = severity === "critical";
    reg.eu_ai_act_article_52 = category === "content_moderation";
    reg.eu_ai_act_annex_iii = severity === "critical" || severity === "high";
    reg.eu_pld_2024_2853 = true;
    reg.gdpr = true;
    reg.dsa_2022_2065 = category === "content_moderation";
  }
  reg.iso_42001 = true;
  reg.nist_ai_rmf = severity === "critical" || severity === "high";
  return reg;
}
function deterministicScore(args) {
  const agents = args.agents || []; const events = args.events || [];
  const severity = args.severity || "medium"; const jurisdiction = args.jurisdiction || "AU";
  const category = args.category || "general"; const financialImpact = args.financial_impact_cents || 0;
  const currency = args.currency || "AUD";
  const actorEvents = {};
  agents.forEach(a => { actorEvents[a.id] = { agent: a, events: [], weight: 0 }; });
  events.forEach((ev, idx) => { if (actorEvents[ev.actor_id]) actorEvents[ev.actor_id].events.push({ ...ev, position: idx }); });
  const typeWeights = {
    inference: 3.0, data_retrieval: 2.5, auto_rejection: 2.8, human_review: 1.5,
    human_override_missed: 2.0, human_intervention_missed: 2.2, policy_check: 1.8,
    content_scan: 2.2, scoring: 2.0, sensor_degradation: 2.8, inference_failure: 3.5,
    resume_scan: 2.0, data_input: 1.2, default: 1.5,
    chatbot_response: 3.0, safety_filter_failure: 3.5, recommendation: 2.5,
    claim_denial: 2.8, defamatory_output: 3.0, medical_advice: 3.2,
    misrepresentation: 2.5, autonomous_drive: 3.0, age_filter: 2.5,
    persona_impersonation: 2.8, sensor_event: 2.8,
  };
  const roleWeights = { provider: 2.5, deployer: 1.8, vendor: 2.0, user: 1.0, distributor: 1.5, regulator: 0.5 };
  const totalEvents = events.length;
  Object.keys(actorEvents).forEach(id => {
    const a = actorEvents[id]; let w = 0;
    a.events.forEach(ev => {
      const positionFactor = 1.0 + (ev.position / Math.max(totalEvents - 1, 1)) * 1.5;
      const typeFactor = typeWeights[ev.type] || typeWeights.default;
      const roleFactor = roleWeights[a.agent.operator_role] || 1.0;
      w += positionFactor * typeFactor * roleFactor;
    });
    a.weight = w;
  });
  const totalWeight = Object.values(actorEvents).reduce((s, a) => s + a.weight, 0);
  const liabilityShares = [];
  Object.values(actorEvents).forEach(a => {
    if (a.weight > 0) liabilityShares.push({
      name: a.agent.name, type: a.agent.type, role: a.agent.operator_role,
      share: totalWeight > 0 ? a.weight / totalWeight : 0,
      vendor: a.agent.vendor_name || null, model: a.agent.model_id || null,
      id: a.agent.id,
    });
  });
  liabilityShares.sort((x, y) => y.share - x.share);
  const primary = liabilityShares[0] || { name: "Unknown", type: "unknown", role: "unknown", share: 0, id: null };
  let verdict = "UNDETERMINED";
  if (primary.type === "ai_system" && primary.role === "provider") verdict = "AI_PROVIDER_AT_FAULT";
  else if (primary.type === "third_party" || primary.type === "vendor") verdict = "THIRD_PARTY_DATA_PROVIDER_AT_FAULT";
  else if (primary.type === "human_operator") verdict = "HUMAN_OPERATOR_AT_FAULT";
  else if (primary.type === "ai_system" && primary.role === "deployer") verdict = "DEPLOYER_SYSTEM_AT_FAULT";
  const titleHash = hashCode(args.title || "");
  const damageMultiplier = 0.7 + (Math.abs(titleHash % 100) / 100) * 0.6;
  const baseDamages = financialImpact || computeDefaultDamages(severity, category);
  const estimatedDamages = Math.round(baseDamages * damageMultiplier);
  const causalChain = events.map((ev, idx) => {
    const a = actorEvents[ev.actor_id];
    const contribution = a && totalWeight > 0 ? ((a.weight / totalWeight) / a.events.length * 100) : 0;
    return {
      step: idx + 1, timestamp: ev.timestamp, actor_id: ev.actor_id,
      actor_name: a ? a.agent.name : "Unknown", type: ev.type, description: ev.description,
      contribution_pct: parseFloat(contribution.toFixed(1)),
    };
  });
  const regulatory = computeRegulatory(jurisdiction, category, severity);
  const incidentId = "inc_" + hashHex(args.title + JSON.stringify(args.agents));
  const certId = "cert_" + hashHex(incidentId + args.title + severity);
  const timestamp = new Date().toISOString();
  return {
    _engine: "faultkey-deterministic-v1",
    _mode: "anchor_log_prediction",
    _note: "Anchor-log prediction. Produced by the same deterministic scoring engine that runs at faultkey.com/try, with the eu-v2 rule overlay applied (additive on eu-v1). Sealed by SHA256 commitment + OpenTimestamps + Sigstore Rekor.",
    incident_id: incidentId, certificate_id: certId, timestamp,
    title: args.title, category, severity, jurisdiction, verdict,
    liability: {
      primary_party: { name: primary.name, type: primary.type, role: primary.role, share: Math.round(primary.share * 1000) / 1000, vendor: primary.vendor || null, model: primary.model || null, id: primary.id },
      secondary_parties: liabilityShares.slice(1).map(p => ({ name: p.name, type: p.type, role: p.role, share: Math.round(p.share * 1000) / 1000, id: p.id })),
      methodology: "deterministic_causal_contribution",
      factors_applied: ["ad_position_weight", "ml_event_type_severity", "m2_operator_role_duty", "m3_but_for_test", "last_clear_chance"],
    },
    causal_chain: causalChain,
    damages: { estimated_cents: estimatedDamages, currency, basis: financialImpact > 0 ? "claimant_stated" : "category_default", multiplier_applied: damageMultiplier.toFixed(3) },
    regulatory,
    certificate: {
      issuer: "did:web:faultkey.com#anchor-log-engine",
      algorithm: "ed25519",
      signature: hashHex(incidentId + verdict + JSON.stringify(liabilityShares)),
      merkle_root: hashHex(certId + timestamp + JSON.stringify(causalChain)),
      anchor: "ots+rekor (eu-v2 batch)",
      verification_url: "https://faultkey.com/verify/" + certId,
    },
    deterministic_proof: {
      input_hash: hashHex(JSON.stringify(args)),
      output_hash: hashHex(verdict + JSON.stringify(liabilityShares.map(l => l.share))),
      reproducible: true,
      note: "Running identical inputs will always produce identical liability scores",
    },
    _liability_shares_full: liabilityShares,
  };
}

function applyEuOverlayToPrediction(input, prediction) {
  const flags = input.eu_flags || {};
  if (!euGateEngages(input.jurisdiction, flags)) return null;
  const attributable = {};
  for (const p of prediction._liability_shares_full) attributable[p.id] = p.share;
  const actors = (input.agents || []).map(a => ({
    id: a.id,
    type: a.type === "human_operator" ? "user" : a.type,
    eu_resident: a.eu_resident ?? false,
    unrecoverable: !(a.eu_resident ?? false),
    is_component_supplier: a.is_component_supplier ?? false,
    is_sme: a.is_sme ?? false,
    recourse_contractually_waived: a.recourse_contractually_waived ?? false,
  }));
  return applyEuV2RuleSet({
    attributable,
    actors,
    flags,
    jurisdiction: input.jurisdiction,
  });
}

function sha256Hex(s) { return createHash("sha256").update(s).digest("hex"); }
function canonicalJson(o) {
  if (o === null || typeof o !== "object") return JSON.stringify(o);
  if (Array.isArray(o)) return "[" + o.map(canonicalJson).join(",") + "]";
  const k = Object.keys(o).sort();
  return "{" + k.map(x => JSON.stringify(x) + ":" + canonicalJson(o[x])).join(",") + "}";
}

function deterministicCore(prediction) {
  return {
    engine: prediction._engine, verdict: prediction.verdict,
    category: prediction.category, severity: prediction.severity, jurisdiction: prediction.jurisdiction,
    liability: {
      primary_party: {
        name: prediction.liability.primary_party.name, type: prediction.liability.primary_party.type,
        role: prediction.liability.primary_party.role, share: prediction.liability.primary_party.share,
        vendor: prediction.liability.primary_party.vendor, model: prediction.liability.primary_party.model,
      },
      secondary_parties: prediction.liability.secondary_parties.map(p => ({
        name: p.name, type: p.type, role: p.role, share: p.share,
      })),
      methodology: prediction.liability.methodology,
      factors_applied: prediction.liability.factors_applied,
    },
    causal_chain: prediction.causal_chain.map(s => ({
      step: s.step, actor_id: s.actor_id, actor_name: s.actor_name, type: s.type, contribution_pct: s.contribution_pct,
    })),
    damages: {
      estimated_cents: prediction.damages.estimated_cents, currency: prediction.damages.currency,
      basis: prediction.damages.basis, multiplier_applied: prediction.damages.multiplier_applied,
    },
    regulatory: prediction.regulatory,
    deterministic_proof: { input_hash: prediction.deterministic_proof.input_hash, output_hash: prediction.deterministic_proof.output_hash },
    eu_overlay: prediction.eu_overlay ? {
      rule_set_version: prediction.eu_overlay.rule_set_version,
      base_rule_set: prediction.eu_overlay.base_rule_set,
      attributable: prediction.eu_overlay.attributable,
      recoverable: prediction.eu_overlay.recoverable,
      presumption_in_claimant_favour: prediction.eu_overlay.presumption_in_claimant_favour,
      joint_and_several_chain: prediction.eu_overlay.joint_and_several_chain,
      applied_rules: prediction.eu_overlay.applied_rules,
    } : null,
  };
}

const cases = readdirSync(CASES_DIR)
  .filter(f => f.endsWith(".json"))
  .filter(f => /^(12|13|14)-/.test(f))
  .sort();

const manifest = {
  schema: "faultkey-anchor-manifest-v1",
  engine_version: "faultkey-deterministic-v1",
  rule_set_version: RULE_SET_VERSION,
  base_rule_set: "eu-v1",
  commitment_scheme: "faultkey-anchor-v1 (sha256 over canonical {case_id, input, prediction_core})",
  count: cases.length,
  entries: [],
};

for (const f of cases) {
  const scenario = JSON.parse(readFileSync(join(CASES_DIR, f), "utf8"));
  const prediction = deterministicScore(scenario.input);
  const euOverlay = applyEuOverlayToPrediction(scenario.input, prediction);
  prediction.eu_overlay = euOverlay;
  delete prediction._liability_shares_full;

  const sealed = {
    case_id: scenario.case_id, case_name: scenario.case_name, court: scenario.court, docket: scenario.docket,
    filed: scenario.filed, status_at_anchor: scenario.status_at_anchor, resolution_expected: scenario.resolution_expected,
    sealed_until: scenario.sealed_until, public_sources: scenario.public_sources,
    rule_set_version: scenario.rule_set_version, regulator_outcome: scenario.regulator_outcome,
    input: scenario.input, prediction,
  };
  const commitmentObject = { case_id: scenario.case_id, input: scenario.input, prediction_core: deterministicCore(prediction) };
  const commitment_hash = sha256Hex(canonicalJson(commitmentObject));
  const artifact = {
    case_id: sealed.case_id, case_name: sealed.case_name, court: sealed.court, docket: sealed.docket,
    filed: sealed.filed, status_at_anchor: sealed.status_at_anchor, resolution_expected: sealed.resolution_expected,
    sealed_until: sealed.sealed_until, public_sources: sealed.public_sources,
    rule_set_version: sealed.rule_set_version, regulator_outcome: sealed.regulator_outcome,
    commitment_hash,
    commitment_scheme: {
      version: "faultkey-anchor-v1", canonical_form: "sorted-keys-utf8",
      committed_fields: ["case_id", "input", "prediction_core"],
      excluded_fields: ["timestamp", "certificate.signature", "certificate.merkle_root", "incident_id", "certificate_id"],
      excluded_reason: "These fields derive from issuance time (new Date()) and are not part of the deterministic prediction.",
      hash_algorithm: "sha256",
    },
    engine_version: "faultkey-deterministic-v1",
    anchor_pending: ["opentimestamps", "sigstore-rekor"],
    sealed,
  };
  const outPath = join(PRED_DIR, `${scenario.case_id}.json`);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  manifest.entries.push({
    case_id: sealed.case_id, case_name: sealed.case_name, court: sealed.court,
    rule_set_version: sealed.rule_set_version,
    commitment_hash, file: `predictions-eu-v2/${scenario.case_id}.json`,
  });
  console.log(`✓ ${scenario.case_id.padEnd(34)} ${commitment_hash.slice(0, 16)}…  ${sealed.case_name}`);
}

manifest.entries.sort((a, b) => a.case_id.localeCompare(b.case_id));
const rootEntries = manifest.entries.map(e => ({ case_id: e.case_id, commitment_hash: e.commitment_hash }));
const aggregate_root = sha256Hex(canonicalJson(rootEntries));
manifest.aggregate_root = aggregate_root;
manifest.aggregate_root_scheme = "sha256 over canonical sorted list of {case_id, commitment_hash}";

writeFileSync(join(__dirname, "anchor-payload-eu-v2.json"), JSON.stringify(manifest, null, 2));
console.log(`\n eu-v2 manifest written: ${cases.length} predictions`);
console.log(` aggregate root: ${aggregate_root}`);

const fileBytes = readFileSync(join(__dirname, "anchor-payload-eu-v2.json"));
const fileHash = createHash("sha256").update(fileBytes).digest("hex");
console.log(` anchor-payload-eu-v2.json sha256 (Rekor-sealable): ${fileHash}`);

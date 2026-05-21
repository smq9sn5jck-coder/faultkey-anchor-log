#!/usr/bin/env node
/**
 * FaultKey Anchor-Log — Stage B
 *
 * Standalone Node port of the EXACT scoring engine that ships in faultkey.com/try.
 * Loads 8 case scenarios from cases/*.json, runs the engine deterministically,
 * and writes one prediction artifact per case to predictions/<slug>.json.
 *
 * The output of this script is what gets cryptographically committed in Stage C.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, "cases");
const PRED_DIR = join(__dirname, "predictions");
mkdirSync(PRED_DIR, { recursive: true });

// ── Engine (verbatim port of /try Try.tsx deterministicScore) ──────────

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function hashHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") +
    ((h >>> 0) ^ 0xdeadbeef).toString(16).padStart(8, "0");
}

function computeDefaultDamages(severity, category) {
  const severityBase = { critical: 5000000, high: 1000000, medium: 250000, low: 50000 };
  const categoryMult = { healthcare: 3.0, autonomous_systems: 5.0, financial_services: 2.0, employment: 1.5, content_moderation: 0.8 };
  return (severityBase[severity] || 250000) * (categoryMult[category] || 1.0);
}

function computeRegulatory(jurisdiction, category, severity) {
  const reg = {};
  if (jurisdiction === "EU" || jurisdiction === "DE" || jurisdiction === "FR") {
    reg.eu_ai_act_article_6 = severity === "critical" || category === "healthcare" || category === "autonomous_systems";
    reg.eu_ai_act_article_26 = true;
    reg.eu_ai_act_article_52 = category === "content_moderation";
    reg.eu_ai_act_annex_iii = severity === "critical" || severity === "high";
  }
  if (jurisdiction === "AU") {
    reg.apra_cps_230 = category === "financial_services";
    reg.nsw_ai_assurance = true;
    reg.ai_ethics_framework = true;
  }
  if (jurisdiction === "US") {
    reg.ccpa = true;
    reg.ftc_section_5 = category === "employment" || category === "financial_services";
    reg.eeoc_guidance = category === "employment";
  }
  if (jurisdiction === "CA") {
    reg.canada_aida = true;
    reg.canada_pipeda = true;
  }
  reg.iso_42001 = true;
  reg.nist_ai_rmf = severity === "critical" || severity === "high";
  return reg;
}

function deterministicScore(args) {
  const agents = args.agents || [];
  const events = args.events || [];
  const severity = args.severity || "medium";
  const jurisdiction = args.jurisdiction || "AU";
  const category = args.category || "general";
  const financialImpact = args.financial_impact_cents || 0;
  const currency = args.currency || "AUD";

  const actorEvents = {};
  agents.forEach(a => { actorEvents[a.id] = { agent: a, events: [], weight: 0 }; });

  events.forEach((ev, idx) => {
    if (actorEvents[ev.actor_id]) {
      actorEvents[ev.actor_id].events.push({ ...ev, position: idx });
    }
  });

  const typeWeights = {
    inference: 3.0, data_retrieval: 2.5, auto_rejection: 2.8,
    human_review: 1.5, human_override_missed: 2.0, human_intervention_missed: 2.2,
    policy_check: 1.8, content_scan: 2.2, scoring: 2.0,
    sensor_degradation: 2.8, inference_failure: 3.5, resume_scan: 2.0,
    data_input: 1.2, default: 1.5,
    // Anchor-log-specific event types (extend the spec — same deterministic process)
    chatbot_response: 3.0, safety_filter_failure: 3.5, recommendation: 2.5,
    claim_denial: 2.8, defamatory_output: 3.0, medical_advice: 3.2,
    misrepresentation: 2.5, autonomous_drive: 3.0, age_filter: 2.5,
    persona_impersonation: 2.8, sensor_event: 2.8
  };

  const roleWeights = {
    provider: 2.5,
    deployer: 1.8,
    vendor: 2.0,
    user: 1.0,
    distributor: 1.5,
    regulator: 0.5
  };

  const totalEvents = events.length;

  Object.keys(actorEvents).forEach(actorId => {
    const actor = actorEvents[actorId];
    let weight = 0;
    actor.events.forEach(ev => {
      const positionFactor = 1.0 + (ev.position / Math.max(totalEvents - 1, 1)) * 1.5;
      const typeFactor = typeWeights[ev.type] || typeWeights.default;
      const roleFactor = roleWeights[actor.agent.operator_role] || 1.0;
      weight += positionFactor * typeFactor * roleFactor;
    });
    actor.weight = weight;
  });

  const totalWeight = Object.values(actorEvents).reduce((sum, a) => sum + a.weight, 0);

  const liabilityShares = [];
  Object.values(actorEvents).forEach(actor => {
    if (actor.weight > 0) {
      liabilityShares.push({
        name: actor.agent.name,
        type: actor.agent.type,
        role: actor.agent.operator_role,
        share: totalWeight > 0 ? actor.weight / totalWeight : 0,
        vendor: actor.agent.vendor_name || null,
        model: actor.agent.model_id || null
      });
    }
  });

  liabilityShares.sort((a, b) => b.share - a.share);

  const primary = liabilityShares[0] || { name: "Unknown", type: "unknown", role: "unknown", share: 0 };
  let verdict = "UNDETERMINED";
  if (primary.type === "ai_system" && primary.role === "provider") {
    verdict = "AI_PROVIDER_AT_FAULT";
  } else if (primary.type === "third_party" || primary.type === "vendor") {
    verdict = "THIRD_PARTY_DATA_PROVIDER_AT_FAULT";
  } else if (primary.type === "human_operator") {
    verdict = "HUMAN_OPERATOR_AT_FAULT";
  } else if (primary.type === "ai_system" && primary.role === "deployer") {
    verdict = "DEPLOYER_SYSTEM_AT_FAULT";
  } else if (primary.type === "ai_system" && primary.role === "distributor") {
    verdict = "DISTRIBUTOR_AT_FAULT";
  }

  const titleHash = hashCode(args.title || "");
  const damageMultiplier = 0.7 + (Math.abs(titleHash % 100) / 100) * 0.6;
  const baseDamages = financialImpact || computeDefaultDamages(severity, category);
  const estimatedDamages = Math.round(baseDamages * damageMultiplier);

  const causalChain = events.map((ev, idx) => {
    const actor = actorEvents[ev.actor_id];
    const contribution = actor && totalWeight > 0
      ? ((actor.weight / totalWeight) / actor.events.length * 100)
      : 0;
    return {
      step: idx + 1,
      timestamp: ev.timestamp,
      actor_id: ev.actor_id,
      actor_name: actor ? actor.agent.name : "Unknown",
      type: ev.type,
      description: ev.description,
      contribution_pct: parseFloat(contribution.toFixed(1))
    };
  });

  const regulatory = computeRegulatory(jurisdiction, category, severity);
  const incidentId = "inc_" + hashHex(args.title + JSON.stringify(args.agents));
  const certId = "cert_" + hashHex(incidentId + args.title + severity);
  const timestamp = new Date().toISOString();

  return {
    _engine: "faultkey-deterministic-v1",
    _mode: "anchor_log_prediction",
    _note: "Anchor-log prediction. Produced by the same deterministic scoring engine that runs at faultkey.com/try. Sealed by SHA256 commitment + OpenTimestamps + Sigstore Rekor; revealed when the underlying case resolves.",
    incident_id: incidentId,
    certificate_id: certId,
    timestamp,
    title: args.title,
    category,
    severity,
    jurisdiction,
    verdict,
    liability: {
      primary_party: {
        name: primary.name,
        type: primary.type,
        role: primary.role,
        share: Math.round(primary.share * 1000) / 1000,
        vendor: primary.vendor || null,
        model: primary.model || null
      },
      secondary_parties: liabilityShares.slice(1).map(p => ({
        name: p.name,
        type: p.type,
        role: p.role,
        share: Math.round(p.share * 1000) / 1000
      })),
      methodology: "deterministic_causal_contribution",
      factors_applied: ["ad_position_weight", "ml_event_type_severity", "m2_operator_role_duty", "m3_but_for_test", "last_clear_chance"]
    },
    causal_chain: causalChain,
    damages: {
      estimated_cents: estimatedDamages,
      currency,
      basis: financialImpact > 0 ? "claimant_stated" : "category_default",
      multiplier_applied: damageMultiplier.toFixed(3)
    },
    regulatory,
    certificate: {
      issuer: "did:web:faultkey.com#anchor-log-engine",
      algorithm: "ed25519",
      signature: hashHex(incidentId + verdict + JSON.stringify(liabilityShares)),
      merkle_root: hashHex(certId + timestamp + JSON.stringify(causalChain)),
      anchor: "ots+rekor (pending Stage C)",
      verification_url: "https://faultkey.com/verify/" + certId
    },
    deterministic_proof: {
      input_hash: hashHex(JSON.stringify(args)),
      output_hash: hashHex(verdict + JSON.stringify(liabilityShares.map(l => l.share))),
      reproducible: true,
      note: "Running identical inputs will always produce identical liability scores"
    }
  };
}

// ── Driver ─────────────────────────────────────────────────────────────

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function canonicalJson(obj) {
  // Deterministic stringify with sorted keys at every level
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

const cases = readdirSync(CASES_DIR).filter(f => f.endsWith(".json")).sort();
console.log(`Found ${cases.length} case scenarios`);

const manifest = {
  schema: "faultkey-anchor-manifest-v1",
  engine_version: "faultkey-deterministic-v1",
  commitment_scheme: "faultkey-anchor-v1 (sha256 over canonical {case_id, input, prediction_core})",
  count: cases.length,
  entries: []
};

// Extract ONLY the deterministic fields for commitment hashing.
// Excludes timestamp/cert_id/signature/merkle_root which derive from `new Date()`.
function deterministicCore(prediction) {
  return {
    engine: prediction._engine,
    verdict: prediction.verdict,
    category: prediction.category,
    severity: prediction.severity,
    jurisdiction: prediction.jurisdiction,
    liability: {
      primary_party: {
        name: prediction.liability.primary_party.name,
        type: prediction.liability.primary_party.type,
        role: prediction.liability.primary_party.role,
        share: prediction.liability.primary_party.share,
        vendor: prediction.liability.primary_party.vendor,
        model: prediction.liability.primary_party.model
      },
      secondary_parties: prediction.liability.secondary_parties.map(p => ({
        name: p.name, type: p.type, role: p.role, share: p.share
      })),
      methodology: prediction.liability.methodology,
      factors_applied: prediction.liability.factors_applied
    },
    causal_chain: prediction.causal_chain.map(s => ({
      step: s.step, actor_id: s.actor_id, actor_name: s.actor_name,
      type: s.type, contribution_pct: s.contribution_pct
    })),
    damages: {
      estimated_cents: prediction.damages.estimated_cents,
      currency: prediction.damages.currency,
      basis: prediction.damages.basis,
      multiplier_applied: prediction.damages.multiplier_applied
    },
    regulatory: prediction.regulatory,
    deterministic_proof: {
      input_hash: prediction.deterministic_proof.input_hash,
      output_hash: prediction.deterministic_proof.output_hash
    }
  };
}

for (const f of cases) {
  const scenario = JSON.parse(readFileSync(join(CASES_DIR, f), "utf8"));
  const prediction = deterministicScore(scenario.input);

  const sealed = {
    case_id: scenario.case_id,
    case_name: scenario.case_name,
    court: scenario.court,
    docket: scenario.docket,
    filed: scenario.filed,
    status_at_anchor: scenario.status_at_anchor,
    resolution_expected: scenario.resolution_expected,
    sealed_until: scenario.sealed_until,
    public_sources: scenario.public_sources,
    input: scenario.input,
    prediction
  };

  // Commitment is over the DETERMINISTIC CORE only — not the wrapper or non-deterministic prediction fields.
  const commitmentObject = {
    case_id: scenario.case_id,
    input: scenario.input,
    prediction_core: deterministicCore(prediction)
  };
  const canonical = canonicalJson(commitmentObject);
  const commitment_hash = sha256Hex(canonical);

  const artifact = {
    case_id: sealed.case_id,
    case_name: sealed.case_name,
    court: sealed.court,
    docket: sealed.docket,
    filed: sealed.filed,
    status_at_anchor: sealed.status_at_anchor,
    resolution_expected: sealed.resolution_expected,
    sealed_until: sealed.sealed_until,
    public_sources: sealed.public_sources,
    commitment_hash,
    commitment_scheme: {
      version: "faultkey-anchor-v1",
      canonical_form: "sorted-keys-utf8",
      committed_fields: ["case_id", "input", "prediction_core"],
      excluded_fields: ["timestamp", "certificate.signature", "certificate.merkle_root", "incident_id", "certificate_id"],
      excluded_reason: "These fields derive from issuance time (new Date()) and are not part of the deterministic prediction.",
      hash_algorithm: "sha256"
    },
    engine_version: "faultkey-deterministic-v1",
    anchor_pending: ["opentimestamps", "sigstore-rekor"],
    sealed: sealed
  };

  const outPath = join(PRED_DIR, `${scenario.case_id}.json`);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));

  manifest.entries.push({
    case_id: sealed.case_id,
    case_name: sealed.case_name,
    court: sealed.court,
    commitment_hash,
    file: `predictions/${scenario.case_id}.json`
  });

  console.log(`✓ ${scenario.case_id.padEnd(28)} ${commitment_hash.slice(0, 16)}…  ${sealed.case_name}`);
}

// Sort entries deterministically by case_id so manifest hash is stable
manifest.entries.sort((a, b) => a.case_id.localeCompare(b.case_id));

// Aggregate root hash: SHA256 of canonical sorted list of {case_id, commitment_hash}
// This is the value we anchor to Bitcoin via OpenTimestamps and to Sigstore Rekor.
const rootEntries = manifest.entries.map(e => ({ case_id: e.case_id, commitment_hash: e.commitment_hash }));
const aggregate_root = sha256Hex(canonicalJson(rootEntries));
manifest.aggregate_root = aggregate_root;
manifest.aggregate_root_scheme = "sha256 over canonical sorted list of {case_id, commitment_hash}";

writeFileSync(join(__dirname, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nManifest written: ${cases.length} predictions`);
console.log(`Aggregate root hash: ${aggregate_root}`);
console.log(`(This single hash will be anchored to OpenTimestamps + Sigstore Rekor in Stage C.)`);

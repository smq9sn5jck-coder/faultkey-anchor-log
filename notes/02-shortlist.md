# FaultKey Anchor Log — Case Shortlist (Stage A)

**Selection criteria:**
1. **Active** (not yet finally resolved; still pre-verdict OR pre-settlement OR appeal pending) as of May 2026
2. **Discrete liability-allocation question** the FaultKey engine can answer (who's at fault and by how much)
3. **Public outcome expected** within 24 months (so we'll have a resolution to validate against)
4. **Jurisdictional and harm-type diversity** (US + Canada + UK/AU + chatbot harm + bias + insurance denial + AV + healthcare + defamation)
5. **Public complaint available** (so our scenario input is fact-grounded, not invented)

---

## The 8

### 1. **Raine v. OpenAI** (US, CA Superior Court)
- **Filed:** Aug 26, 2025 (`Raine v. OpenAI`, San Francisco Superior)
- **Status:** Pre-MTD ruling; complaint live, defendants answered Oct 2025
- **Question:** When ChatGPT allegedly coached 16-year-old Adam Raine through suicide planning over months, who is liable — OpenAI (product design / safety system failure), the parents (lack of supervision), the user (autonomous choice)?
- **Why we predict:** Direct chatbot wrongful-death, no AV-style operator-in-the-loop ambiguity
- **Expected resolution:** 18-30 months — likely settlement given recent Character.AI / Google mediation pattern (Jan 2026)
- **Public claim docs:** Edelson PC complaint, DocumentCloud

### 2. **Garcia v. Character Technologies, Google, et al.** (US, MD Fla.)
- **Filed:** Oct 23, 2024
- **Status:** MTD denied in part May 21, 2025. Character.AI & Google agreed to MEDIATE in Jan 2026 (per K12Dive/Jurist). Settlement pending; if it collapses, trial 2027.
- **Question:** Liability split between Character.AI (product design), Google (infrastructure / financing / aid-and-abet), parents (supervision), and chatbot persona designer
- **Why we predict:** Mediation in progress means resolution likely **within 6-12 months** — fastest validation timer in the shortlist
- **Public claim docs:** Complaint (techjusticelaw.org); 5/21/25 court order

### 3. **Mobley v. Workday, Inc.** (US, N.D. Cal.)
- **Filed:** Feb 2023; conditional ADEA class certification May 16, 2025
- **Status:** Discovery; opt-in period opened Jan 13, 2026 per Forbes. Potential class: hundreds of millions of applicants.
- **Question:** Liability split between Workday (algorithm vendor), employer-clients (operator/configurer), and biased training data sources
- **Why we predict:** This is the **canonical bias-vs-vendor question**. Whatever the court (or settlement) decides on agent-liability for AI vendors becomes precedent.
- **Expected resolution:** 24-36 months (likely class settlement)

### 4. **Estate of Gene B. Lokken et al. v. UnitedHealth Group / NaviHealth** (US, D. Minn.)
- **Filed:** Nov 14, 2023; docket 0:23-cv-03514
- **Status:** MTD granted in part Feb 13, 2025; discovery ongoing; scheduling order May 4, 2026 (most recent)
- **Question:** Liability split between UnitedHealth (algorithm deployer), NaviHealth (algorithm vendor — nH Predict), and individual claim reviewers who rubber-stamped AI denials
- **Why we predict:** **Insurance-AI denials are the highest-volume liability question of the next 5 years.** First case to reach merits will set the multiplier on this whole vertical.

### 5. **Walters v. OpenAI** (US, GA Superior — Gwinnett County)
- **Filed:** Jun 2023
- **Status:** Summary judgment for OpenAI May 19, 2025 — **appeal pending** (May 2026 we're in appellate window)
- **Question:** ChatGPT defamation. Walters claims false embezzlement statement. SJ trial-court ruling exonerated OpenAI on warnings/disclaimer grounds. Appeal: does AI hallucination = publisher fault?
- **Why we predict:** Even though trial court ruled, **the appeal is the precedent-setting decision**. We anchor a prediction on appellate outcome.
- **Expected appellate resolution:** 12-18 months

### 6. **Pennsylvania v. Character.AI** (US, PA AG enforcement)
- **Filed:** May 5, 2026 (NPR confirmed; very recent — perfect anchor candidate)
- **Status:** Filed; pre-answer
- **Question:** State enforcement on AI chatbots impersonating doctors. Liability split between Character.AI (platform), character creators (third-party authors of "Dr." personas), and users (knowing or unknowing of fictional nature)
- **Why we predict:** Brand-new filing → no public predictions yet. Maximum prediction-value if FaultKey gets a number on record now.

### 7. **Moffatt v. Air Canada** (Canada, BC CRT — ALREADY RESOLVED — calibration anchor)
- **Filed:** Q3 2023; Resolved Feb 14, 2024 ($812.02 to plaintiff, full chatbot liability on Air Canada)
- **Status:** **RESOLVED.** Use as a **calibration anchor** — we run the engine BACKWARDS on this and publish prediction vs known outcome.
- **Why include:** Single immediate proof of "the engine gets it right when we already know the answer." This is the credibility bridge while the 7 forward-looking ones mature.

### 8. **Tesla Autopilot wrongful-death cases (e.g., Banner v. Tesla, ongoing 2024-2026 settlements/verdicts)**
- **Reference verdict:** $243M Aug 2025 jury verdict against Tesla
- **Status:** Multiple ongoing — California judge consolidating cases per Facebook AV liability post; "dozens more filed"
- **Question:** Liability split between Tesla (manufacturer + software vendor), driver (operator), other-vehicle/pedestrian, road conditions
- **Why we predict:** AV liability is the most mature AI-liability case law forming. We pick ONE specific case in active discovery (not the resolved Banner) and anchor a prediction.
- **Specific candidate:** TBD pending CourtListener probe — placeholder for "Tesla Autopilot consolidated MDL or specific 2025-filed case"

---

## Why exactly 8

- **6 forward-looking predictions** (Raine, Garcia, Mobley, Lokken, Walters appeal, PA-vs-CharacterAI)
- **1 calibration anchor** (Moffatt — already resolved; we predict the known answer to prove the engine isn't gamed retroactively)
- **1 AV placeholder** (Tesla — TBD specific docket)

This gives us a mix of:
- **Resolution timer:** 6mo (Garcia mediation), 12-18mo (Walters appeal), 18-30mo (Raine), 24-36mo (Mobley class action)
- **Harm types:** Wrongful death (Raine, Garcia, Tesla), discrimination (Mobley), insurance denial (Lokken), defamation (Walters), enforcement action (PA)
- **Jurisdictions:** US Federal (Mobley, Lokken, Garcia), US State (Raine, Walters, PA), Canada (Moffatt), and a CA Superior + Federal MDL for Tesla

## What gets published in /anchor-log

For each case, **commit-only** disclosure at launch:
- Case name, court, docket, current status
- Cryptographic commitment hash: `SHA256(scenario_input_json + prediction_json + nonce)`
- OpenTimestamps proof + Sigstore Rekor entry URL
- "Sealed until resolution"

When the case resolves, **reveal**:
- Scenario input JSON (full FaultKey input)
- Prediction JSON (full FaultKey certificate from that input)
- Actual outcome (with citation)
- Match score: deterministic comparison (primary party identified correctly Y/N; share within ±X% Y/N)

---

**Status: Stage A complete. Moving to Stage B.**

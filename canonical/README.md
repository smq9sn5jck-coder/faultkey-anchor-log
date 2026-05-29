# FaultKey · Canonical Demo Anchor

This directory hosts the **canonical externally-verifiable audit batch**
that anyone can verify end-to-end with the open-source verifier.

## What's here

| File | Purpose |
| ---- | ------- |
| `canonical-demo-anchor-2026-05-29.json` | A real `causallayer.audit-batch.v1` anchor record. References three real artefacts in this repo as Merkle leaves; signed under the canonical demo key. |
| `canonical-demo-key.pem` | Public key used to sign this anchor (Ed25519, SPKI PEM). |
| `canonical-demo-key.fingerprint.txt` | `sha256(SPKI DER)` fingerprint of the public key. The anchor's `signature.pubkey_sha256_fingerprint` field MUST match this value. |

## Verify it yourself

In any terminal with Node ≥ 18 and `npx` available:

```bash
curl -sLO https://raw.githubusercontent.com/smq9sn5jck-coder/faultkey-anchor-log/master/canonical/canonical-demo-anchor-2026-05-29.json
curl -sLO https://raw.githubusercontent.com/smq9sn5jck-coder/faultkey-anchor-log/master/canonical/canonical-demo-key.pem
npx -p causallayer-verifier@latest causallayer-verify canonical-demo-anchor-2026-05-29.json --key canonical-demo-key.pem
```

You should see:

```
schema       : causallayer.audit-batch.v1
leaf count   : 3
body sha256  : OK
merkle root  : OK
pubkey fp    : OK
ed25519 sig  : OK    signed_field=batch_body_sha256
```

If any field reports `FAIL`, the anchor or key has been tampered with —
report it as a security issue.

## What's verified

The verifier proves **all four** of the following independently:

1. **Body integrity** — `batch_body_sha256` is the SHA-256 of the canonicalised body bytes.
2. **Merkle integrity** — `batch_merkle_root` is the Bitcoin-style Merkle root over `leaves[].sha256`.
3. **Public-key identity** — `signature.pubkey_sha256_fingerprint` matches `sha256(SPKI DER)` of the supplied public key.
4. **Ed25519 signature** — `signature.signature_hex` is a valid Ed25519 signature over `utf8(batch_body_sha256)` under the supplied key.

If any one of those fails, the verifier reports `FAIL` on that line.

## Honest scope note

This anchor is **signed under the canonical demo key**, not under the
production CausalLayer engine signing key. Its purpose is to give external
reviewers a real, externally-verifiable artefact with a stable URL —
nothing more.

The production engine's audit batches are anchored separately (see the
top-level `anchor-payload*.json` files in this repo) under the production
engine signing key.

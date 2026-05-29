# Methodology Anchors

This directory pins every published version of the **FaultKey Engine Brief** — the document that defines how attribution is computed and which methodology IDs are in force.

Each file in this directory is a JSON anchor record. The pattern is:

- One JSON record per methodology version, named `methodology-vX.Y.Z.json`.
- Each record contains the SHA-256 of the canonical PDF as published at `https://faultkey.com/docs/<filename>`.
- Each record is committed in a single commit, with a commit message of the form `methodology vX.Y.Z anchor — sha256:<first-12-chars>`.
- Records are **append-only**. A new methodology version is added as a new file; previous files are never modified.

## Why this exists

Every `CausalCertificateV1` emitted by the FaultKey engine cites the methodology version it was issued under (e.g. `methodology_version: "1.0.0"`). Anyone holding a cert can:

1. Look up the corresponding `methodology-vX.Y.Z.json` in this directory.
2. Download the PDF at `artifact.public_url`.
3. Compute `sha256` of the downloaded PDF.
4. Confirm it matches `artifact.sha256` in the anchor record.
5. Read the exact methodology the cert was issued under.

This is the foundation that makes deterministic attribution auditable: the engine version + methodology version are both publicly pinned and tamper-evident.

## Index

| Version | Published (UTC) | Engine versions covered | SHA-256 (first 16) |
|---|---|---|---|
| 1.0.0 | 2026-05-29 22:30 | faultkey-deterministic-v1 + calb2-v0.7 | `42b2b2d719e51366` |

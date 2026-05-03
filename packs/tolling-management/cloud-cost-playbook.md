# Cloud Cost Playbook

## Cost Drivers

- raw image storage
- OCR and computer vision calls
- event streaming and enrichment
- payment provider calls
- notification vendor calls
- support model calls
- reporting queries over high-volume transaction tables

## Controls

- Use idempotent ingestion to prevent replay charges and wasted processing.
- Store thumbnails separately from raw images.
- Apply customer-owned image retention policy.
- Batch OCR when real-time processing is not needed.
- Cache rate tables and facility metadata.
- Use compact retrieval before large-model support answers.
- Keep vendor adapters behind contracts so redundant tools can be replaced.
- Measure cost per 1,000 lane events, per image reviewed, per support case deflected, and per facility.

## Benchmark Measures

- prompt tokens avoided
- OCR calls avoided
- duplicate postings avoided
- manual review minutes reduced
- storage cost reduced
- support cases deflected safely

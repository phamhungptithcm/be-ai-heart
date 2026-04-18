export const workerManifest = {
  service: "worker",
  jobs: ["scan-repository", "refresh-graph", "generate-benchmark-report"],
};

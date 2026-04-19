export const workerManifest = {
  service: "worker",
  jobs: [
    "scan-repository",
    "refresh-graph",
    "generate-diagrams",
    "sync-portal-profile",
    "sync-admin-support-profile",
    "generate-benchmark-report",
  ],
};

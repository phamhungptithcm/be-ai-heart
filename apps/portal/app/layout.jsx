import "./globals.css";
import { createPortalMetadata } from "../src/metadata.js";

export const metadata = createPortalMetadata({
  title: "Customer portal",
  description: "Customer portal for synced repositories, diagrams, documents, usage, and benchmark visibility.",
  path: "/",
  keywords: ["portal", "repositories", "benchmarks", "documents"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

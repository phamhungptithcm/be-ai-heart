import "./globals.css";
import { createAdminMetadata } from "../src/metadata.js";

export const metadata = createAdminMetadata({
  title: "Internal admin",
  description: "Internal admin for customer intake, revenue, support, benchmarks, and repository operations.",
  path: "/",
  keywords: ["admin", "support", "revenue", "benchmarks"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

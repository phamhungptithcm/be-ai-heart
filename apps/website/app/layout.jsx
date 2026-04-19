import "./globals.css";
import { createWebsiteMetadata } from "../src/metadata.js";

export const metadata = createWebsiteMetadata({
  title: "Project memory, ROI proof, and governed AI delivery",
  description: "Public website for onboarding, trial signup, demo booking, pricing, benchmark proof, and product narrative.",
  path: "/",
  keywords: ["AI coding", "project memory", "benchmark ROI", "MCP", "CLI"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

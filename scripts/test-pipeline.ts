import "dotenv/config";
import { frontClient } from "../lib/front";
import { processConversation } from "../lib/pipeline";
import type { FrontConversation } from "../types";

async function main() {
  console.log("=== FAAR_bot Pipeline Test ===\n");

  const frontToken = process.env.FRONT_API_TOKEN;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!frontToken || frontToken.length < 5) {
    console.error("❌ FRONT_API_TOKEN is not set or appears invalid in .env.local");
    process.exit(1);
  }
  if (!deepseekKey || deepseekKey.length < 5) {
    console.error("❌ DEEPSEEK_API_KEY is not set or appears invalid in .env.local");
    process.exit(1);
  }

  console.log("✅ FRONT_API_TOKEN: set");
  console.log("✅ DEEPSEEK_API_KEY: set");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("⚠️  DATABASE_URL is not set — results will not be persisted to DB");
  } else {
    console.log("✅ DATABASE_URL: set");
  }

  console.log("\n--- Step 1: Checking Front API connectivity ---");
  try {
    const { data: statuses } = await frontClient.getCompanyStatuses();
    const waitingStatus = statuses._results.find((s) => s.category === "waiting");
    console.log(`✅ Connected to Front API`);
    console.log(`   Ticketing enabled: ${statuses._results.length > 0 ? "Yes" : "No"}`);
    if (waitingStatus) {
      console.log(`   Waiting status: "${waitingStatus.name}" (ID: ${waitingStatus.id})`);
    } else if (statuses._results.length > 0) {
      console.log(`   No "waiting" category status found. Available categories:`);
      statuses._results.forEach((s) => {
        console.log(`     - ${s.name} (category: ${s.category}, id: ${s.id})`);
      });
    }
  } catch (e) {
    console.error(`❌ Failed to connect to Front API: ${(e as Error).message}`);
    process.exit(1);
  }

  console.log("\n--- Step 2: Listing message templates ---");
  try {
    const { data: templatesData } = await frontClient.listMessageTemplates();
    console.log(`✅ Found ${templatesData._results.length} message templates`);
    templatesData._results.forEach((t) => {
      const hasVars = /\{\{[^}]+\}\}/.test(t.body);
      console.log(`   - ${t.name} (${t.id}) ${hasVars ? "[has unresolved variables]" : ""}`);
    });
  } catch (e) {
    console.error(`❌ Failed to fetch templates: ${(e as Error).message}`);
    process.exit(1);
  }

  console.log("\n--- Step 3: Fetching 5 open conversations ---");
  let conversations: FrontConversation[] = [];
  try {
    const testParams = new URLSearchParams();
    testParams.append("q[statuses]", "unassigned");
    testParams.append("q[statuses]", "assigned");
    testParams.append("limit", "5");

    const { data } = await frontClient.listConversations(testParams);
    conversations = data._results;
    console.log(`✅ Fetched ${conversations.length} open conversations`);
    conversations.forEach((c) => {
      console.log(`   - [${c.id.slice(0, 12)}...] ${c.subject ?? "(no subject)"}`);
    });
  } catch (e) {
    console.error(`❌ Failed to fetch conversations: ${(e as Error).message}`);
    process.exit(1);
  }

  if (conversations.length === 0) {
    console.log("\nNo open conversations found. Nothing to process.");
    process.exit(0);
  }

  console.log("\n--- Step 4: Running DeepSeek on each conversation (DRY RUN — no replies sent) ---\n");

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    console.log(`[${i + 1}/${conversations.length}] Processing: ${conv.subject ?? "(no subject)"}`);
    try {
      const result = await processConversation(conv.id, true);
      const icon = result.confidence >= 85 ? "🟢" : result.confidence >= 60 ? "🟡" : "🔴";
      console.log(`  ${icon} Template: "${result.selectedTemplate}" (${result.templateId})`);
      console.log(`  Confidence: ${result.confidence}/100`);
      console.log(`  Reasoning: ${result.reasoning.slice(0, 120)}`);
      console.log(`  Status: ${result.status}`);
      console.log("");
    } catch (e) {
      console.log(`  ❌ Error: ${(e as Error).message}\n`);
    }
  }

  console.log("=== Pipeline test complete ===");
  console.log("All processing was in DRY RUN mode — no replies were actually sent.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

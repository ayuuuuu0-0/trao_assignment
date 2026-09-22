import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { runPipeline } from "@prepkit/core";
import { BatchCaseInput, BatchCaseInputSchema, BatchOutput, BatchCaseResult } from "@prepkit/core";
import { startDemoServer } from "./demoServer.js";

process.env.ALLOW_PRIVATE_HOSTS = "true";

interface CliArgs {
  inputPath: string;
  outputPath: string;
  useFakeLlm: boolean;
}

function parseArgs(args: string[]): CliArgs {
  let inputPath = "";
  let outputPath = "";
  let useFakeLlm = process.env.USE_FAKE_LLM === "true";
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input" && i + 1 < args.length) {
      inputPath = args[++i];
    } else if (arg.startsWith("--input=")) {
      inputPath = arg.slice("--input=".length);
    } else if (arg === "--output" && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    } else if (arg === "--fake") {
      useFakeLlm = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (!inputPath && positional.length > 0) {
    inputPath = positional[0];
  }
  if (!outputPath && positional.length > 1) {
    outputPath = positional[1];
  }

  if (!inputPath || !outputPath) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json> [--fake]");
    process.exit(1);
  }

  return { inputPath, outputPath, useFakeLlm };
}

async function main() {
  const { inputPath, outputPath, useFakeLlm } = parseArgs(process.argv.slice(2));

  const resolvedInput = path.resolve(process.cwd(), inputPath);
  const resolvedOutput = path.resolve(process.cwd(), outputPath);

  let rawData: string;
  try {
    rawData = await fs.readFile(resolvedInput, "utf-8");
  } catch (err: any) {
    console.error(`Failed to read input file at ${resolvedInput}: ${err.message}`);
    process.exit(1);
  }

  let cases: unknown;
  try {
    cases = JSON.parse(rawData);
  } catch (err: any) {
    console.error(`Invalid JSON in input file: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(cases)) {
    console.error("Input file must contain a JSON array of cases.");
    process.exit(1);
  }

  // Start internal demo server if any case uses localhost:8099 and no external base URL is given
  let demoServerHandle: { close: () => Promise<void> } | null = null;
  const demoBaseUrl = process.env.DEMO_SITE_BASE_URL;

  const needsLocalDemoServer = !demoBaseUrl && cases.some((c: any) =>
    typeof c?.company_url === "string" && c.company_url.includes("localhost:8099")
  );

  if (needsLocalDemoServer) {
    demoServerHandle = await startDemoServer(8099);
  }

  const output: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: []
  };

  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });

  const totalCases = cases.length;
  console.error(`Starting evaluation of ${totalCases} case(s)...`);

  try {
    for (let index = 0; index < totalCases; index++) {
      const rawCase = cases[index];
      const caseId = (rawCase && typeof rawCase === "object" && "id" in rawCase && typeof rawCase.id === "string")
        ? rawCase.id
        : `case-${index + 1}`;

      console.error(`[${index + 1}/${totalCases}] Processing case: ${caseId}`);

      // Substitute DEMO_SITE_BASE_URL if configured per D20
      let processedCase = { ...(rawCase as object) };
      if (demoBaseUrl && typeof (processedCase as any).company_url === "string") {
        const currentUrl = (processedCase as any).company_url;
        if (currentUrl.startsWith("http://localhost:8099/")) {
          (processedCase as any).company_url = currentUrl.replace(
            "http://localhost:8099/",
            demoBaseUrl.endsWith("/") ? demoBaseUrl : `${demoBaseUrl}/`
          );
        }
      }

      const parseResult = BatchCaseInputSchema.safeParse(processedCase);
      if (!parseResult.success) {
        const errorResult: BatchCaseResult = {
          id: caseId,
          status: "failed",
          kit: null,
          error: {
            code: "INVALID_INPUT",
            message: parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
          }
        };
        output.kits.push(errorResult);
        await fs.writeFile(resolvedOutput, JSON.stringify(output, null, 2), "utf-8");
        continue;
      }

      const validatedCase: BatchCaseInput = parseResult.data;

      try {
        const pipelinePromise = runPipeline(validatedCase, {
          allowPrivateHosts: true,
          timeoutMs: 150000,
          useFakeLlm
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("CASE_TIMEOUT"));
          }, 150000);
        });

        const result = await Promise.race([pipelinePromise, timeoutPromise]);
        output.kits.push(result);
      } catch (err: any) {
        const isTimeout = err.message === "CASE_TIMEOUT";
        output.kits.push({
          id: validatedCase.id,
          status: "failed",
          kit: null,
          error: {
            code: isTimeout ? "CASE_TIMEOUT" : "PIPELINE_ERROR",
            message: isTimeout ? "Case execution exceeded 150 second timeout budget." : err.message
          }
        });
      }

      await fs.writeFile(resolvedOutput, JSON.stringify(output, null, 2), "utf-8");
    }

    console.error(`Evaluation complete. Output written to ${resolvedOutput}`);
  } finally {
    if (demoServerHandle) {
      await demoServerHandle.close();
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(`Unexpected fatal error during evaluation: ${err.message}`);
  process.exit(1);
});

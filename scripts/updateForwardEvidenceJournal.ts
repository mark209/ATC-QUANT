import { writeFileSync } from "node:fs";
import {
  buildForwardEvidenceReport,
  FORWARD_EVIDENCE_REPORT_PATH,
  runForwardEvidenceAccumulator
} from "./forwardEvidenceShared";

async function main() {
  console.log("ATC FORWARD EVIDENCE JOURNAL UPDATE");
  console.log("Mode: paper-only append-only journal. No production sizing changes and no broker execution.");

  const result = await runForwardEvidenceAccumulator({ appendNewRows: true });
  writeFileSync(FORWARD_EVIDENCE_REPORT_PATH, buildForwardEvidenceReport(result));

  console.log(`Attempted rows: ${result.attemptedRows}`);
  console.log(`Appended rows: ${result.appendedRows}`);
  console.log(`Skipped duplicate rows: ${result.duplicateRows}`);
  console.log(`Invalid rows: ${result.invalidRows}`);
  console.log(`Pending outcome rows: ${result.evaluation.journalStatus.pendingOutcomeRows}`);
  console.log(`Evaluation-ready rows: ${result.evaluation.journalStatus.evaluationReadyRows}`);
  console.log(`Enough evidence exists: ${result.evaluation.thresholdStatus.enoughEvidenceExists ? "yes" : "no"}`);
  console.log(`Final verdict: ${result.evaluation.finalVerdict}`);
  console.log(`Wrote ${FORWARD_EVIDENCE_REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

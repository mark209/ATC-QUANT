import { DatasetLibrary } from "../src/lib/datasets/datasetLibrary";

const library = new DatasetLibrary("datasets");
const result = await library.validateAll();
await library.writeReports(result);
if (result.reports.length === 0) console.log("No institutional datasets to validate. Validation infrastructure is ready; real snapshots must be supplied.");
for (const report of result.reports) console.log(`${report.dataset_id}: ${report.valid ? "VALID" : "INVALID"} errors=${report.errors.length} warnings=${report.warnings.length}`);
console.log(`Validation report: datasets/validation-report.json`);
console.log(`Coverage report: datasets/coverage-report.json`);

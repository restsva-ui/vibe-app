import fs from "node:fs";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const versions = files.map((name) => name.match(/^(\d+)_/)?.[1]).filter(Boolean);

const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
if (duplicates.length) {
  console.error("Duplicate migration versions:", [...new Set(duplicates)]);
  process.exit(1);
}

const productionBaseline = [
  "20261002140636",
  "20261002155153",
  "20261002161917",
  "20261002162427",
  "20261002164124",
  "20261003113424",
  "20261003113931",
  "20261003114109",
  "20261003114254",
  "20261003114532",
  "20261003122259",
  "20261003122312",
  "20261003122748",
  "20261003152803",
  "20261003152957",
  "20261003164022",
  "20261003164054",
  "20261003173109",
  "20261003173530",
  "20261003175045",
  "20261003181702",
  "20261003185009",
  "20261003190518",
  "20261003190750",
  "20261003190856",
  "20261003191041",
  "20261004090101",
  "20261004090121",
  "20261004111209",
  "20261004155124",
  "20261004160010",
  "20261004161109",
  "20261004172219",
  "20261004174853",
  "20261004180004"
];

const missing = productionBaseline.filter((version) => !versions.includes(version));
if (missing.length) {
  console.error("Production baseline migration versions missing from repository:", missing);
  process.exit(1);
}

console.log(`Migration catalog OK: ${files.length} files, ${productionBaseline.length} production baseline versions represented, no duplicate versions.`);

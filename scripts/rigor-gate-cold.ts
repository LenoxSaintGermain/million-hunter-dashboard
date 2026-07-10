/**
 * 004 A-3 — Rigor gate COLD runs on GT-001/GT-002/GT-003.
 * Calls the PRODUCTION runRedTeamAnalysis (server/gemini.ts) once per deal —
 * no follow-up prompting, no outcome data, no severity labels in inputs.
 * Inputs = broker sheet + neutrally-phrased knowable-before-close diligence facts
 * (same methodology as the original GT-001 gate record).
 * Zero DB access. Writes raw outputs to rigor-gate-raw.json in this directory.
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { runRedTeamAnalysis } from "../server/gemini";

const REPO = "/Volumes/Mini_2T/lenoxparis data/Dev/million-hunter-dashboard";

const inputs = [
  {
    id: "GT-001",
    deal: {
      name: "Apex Commercial Cleaning (composite)",
      industry: "Commercial Cleaning Services",
      location: "Charlotte, NC",
      revenue: 1850000,
      cashFlow: 720000,
      askingPrice: 2100000,
      multiple: 2.9,
      employees: 14,
      yearEstablished: 2015,
      description: [
        "Broker: Established commercial cleaning company with 11-year track record. Consistent revenue growth. Owner retiring. Strong recurring contract base. SBA pre-qualified.",
        "Diligence data points from standard document requests:",
        "- Add-back schedule totals $223k: $85k owner salary above market replacement, $62k personal vehicle fleet, $41k consulting payments to family members, $35k one-time equipment write-off.",
        "- Revenue by customer: top 2 clients = 54% of revenue (regional hospital system $512k/yr = 28%; office park management co $484k/yr = 26%).",
        "- Revenue grew 18% over 3 years; contract count constant at 23; no new client logos in 24 months.",
        "- Owner works 55-60 hours/week; no operations manager on staff.",
        "- Equipment schedule: 6 of 9 floor machines are 7+ years old (industry replacement cycle: 5 years).",
      ].join("\n"),
    },
    expected_failure_modes: [
      "add-back / SDE inflation",
      "customer concentration (top-2 54%)",
      "owner dependence / key-man risk",
    ],
  },
  {
    id: "GT-002",
    deal: {
      name: "Piedmont Pest Control (composite)",
      industry: "Pest Control (Residential Route)",
      location: "Piedmont region, NC",
      revenue: 1500000,
      cashFlow: 650000,
      askingPrice: 2270000,
      multiple: 3.5,
      employees: 9,
      yearEstablished: 2018,
      description: [
        "Broker: Established residential pest control route with 1,200 recurring accounts. Owner-operated. Strong recurring revenue. Priced to sell.",
        "Diligence data points from standard document requests:",
        "- Account cohort data: account count 1,180 → 1,200 over 3 years (+1.7%); revenue +34% over the same period; annual account churn 22%.",
        "- Add-back schedule includes $95k 'owner discretionary'. Owner time audit shows the owner personally performs ~30% of service routes. Market rate for a licensed pest control technician: $65-75k fully loaded.",
        "- Revenue by customer: 1,200 residential accounts, largest is $4,200/yr (<3% of revenue).",
        "- Staff roster: lead technician (8 years tenure) holds the state applicator license that covers 60% of the service territory. Employee reference checks indicate he has been interviewing elsewhere.",
      ].join("\n"),
    },
    expected_failure_modes: [
      "growth is price increases on flat account base (with high churn), not organic volume",
      "add-back overstatement: 'owner discretionary' is actually replacement labor cost",
      "key-employee departure risk tied to the applicator license / service authorization",
    ],
  },
  {
    id: "GT-003",
    deal: {
      name: "Logistics Express Charlotte (composite)",
      industry: "Last-Mile Logistics & Delivery",
      location: "Charlotte, NC",
      revenue: 6500000,
      cashFlow: 1900000,
      askingPrice: 7600000,
      multiple: 4.0,
      employees: 38,
      yearEstablished: 2012,
      description: [
        "Broker: Established logistics and delivery company serving commercial and government clients. Long-term contracts. Strong management team. Owner stepping back.",
        "Diligence data points from standard document requests:",
        "- Revenue by customer: one federal GSA-schedule delivery contract = $3.05M/yr (47% of revenue); top 3 commercial clients = additional 31% (top-4 total: 78%).",
        "- The GSA contract's expiration date (public on SAM.gov) is 18 months out; it goes to re-compete at that time.",
        "- Operations data: company runs at 78% of contracted route capacity due to CDL driver availability; contracted capacity implies $8.3M revenue.",
      ].join("\n"),
    },
    expected_failure_modes: [
      "contract cliff: 47%-of-revenue government contract expiring / re-competing in 18 months",
      "extreme customer concentration (top-4 = 78%)",
      "structural driver shortage capping capacity (and paying 4.0x on cliff-exposed earnings)",
    ],
  },
];

async function main() {
  const results: any[] = [];
  for (const t of inputs) {
    process.stderr.write(`Running Red Team cold on ${t.id}...\n`);
    const started = Date.now();
    const raw = await runRedTeamAnalysis(t.deal as any);
    results.push({
      test_deal: t.id,
      model: "gemini-3.1-pro-preview",
      duration_ms: Date.now() - started,
      input_description: t.deal.description,
      expected_failure_modes: t.expected_failure_modes,
      raw_red_team_output: raw,
    });
    process.stderr.write(`  killProbability=${raw.killProbability} flags=${raw.redFlags.length}\n`);
  }

  const out = new URL("./rigor-gate-raw.json", import.meta.url).pathname.replace(/%20/g, " ");
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`Wrote ${out}`);
}
main();

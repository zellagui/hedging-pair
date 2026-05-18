/** One row of your firm sheet: phases 2–7 only; phase 1 = `fee` as cash out in the app. */
export type SampleSpreadsheetRow = {
  name: string;
  disbursementAt: string;
  fee: number;
  ledgerPhases: (number | null)[];
};

/** TEST001 … TEST017 (comma decimals from your file → `.` here). */
export const SAMPLE_SPREADSHEET_ROWS: readonly SampleSpreadsheetRow[] = [
  {
    name: "LFE050-E6Q1QQ66-TEST001",
    disbursementAt: "2026-05-07",
    fee: 84,
    ledgerPhases: [104.94, null, null, null, null, null],
  },
  {
    name: "LFE050-860WAQ3I-TEST002",
    disbursementAt: "2026-05-07",
    fee: 84,
    ledgerPhases: [110.72, null, null, null, null, null],
  },
  {
    name: "LFE050-W0A1C08A-TEST003",
    disbursementAt: "2026-05-08",
    fee: 84,
    ledgerPhases: [-85.97, -155.61, 424.58, null, null, null],
  },
  {
    name: "LFE050-817J3UEV-TEST004 - LFF050-73QT76IS-PRO002",
    disbursementAt: "2026-05-10",
    fee: 84,
    ledgerPhases: [-89.27, -166.16, -771.76, -63.63, -29.44, 1217.79],
  },
  {
    name: "LFE050-7K4XC18S-TEST005",
    disbursementAt: "2026-05-10",
    fee: 84,
    ledgerPhases: [-89.27, 198.71, null, null, null, null],
  },
  {
    name: "LFE050-E1JRI633-TEST006",
    disbursementAt: "2026-05-10",
    fee: 98,
    ledgerPhases: [104.38, null, null, null, null, null],
  },
  {
    name: "LFE050-OMV4K485-TEST007",
    disbursementAt: "2026-05-11",
    fee: 98,
    ledgerPhases: [111.83, null, null, null, null, null],
  },
  {
    name: "LFE050-SV49ZK87-TEST008",
    disbursementAt: "2026-05-11",
    fee: 98,
    ledgerPhases: [117.43, null, null, null, null, null],
  },
  {
    name: "LFE050-9DXFS712-TEST009",
    disbursementAt: "2026-05-11",
    fee: 98,
    ledgerPhases: [115.68, null, null, null, null, null],
  },
  {
    name: "LFE050-64HRK22F-TEST010 - LFF050-NV8Q5T76-PRO003",
    disbursementAt: "2026-05-12",
    fee: 98,
    ledgerPhases: [-94.33, -168.84, 426.7, null, null, null],
  },
  {
    name: "LFE050-7R36RUJ6-TEST011",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [110.78, null, null, null, null, null],
  },
  {
    name: "LFE050-N5225GFP-TEST012",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [-97.3, null, null, null, null, null],
  },
  {
    name: "LFE050-4TD1LO75-TEST013",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [112, null, null, null, null, null],
  },
  {
    name: "LFE050-G29TZ9Z7-TEST014",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [-99.05, null, null, null, null, null],
  },
  {
    name: "LFE050-7T0T8BW7-TEST015",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [-95.38, null, null, null, null, null],
  },
  {
    name: "LFE050-6LQ9Y64Q-TEST016",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [-99.05, null, null, null, null, null],
  },
  {
    name: "LFE050-LP7S405A-TEST017",
    disbursementAt: "2026-05-15",
    fee: 98,
    ledgerPhases: [-95.73, null, null, null, null, null],
  },
];

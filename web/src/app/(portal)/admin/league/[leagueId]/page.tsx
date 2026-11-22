import Link from "next/link";
import { notFound } from "next/navigation";
import { LeagueBackendClient } from "./league-backend-client";

export const dynamic = "force-dynamic";

interface LeagueMeta {
  id: string;
  name: string;
  domain: string;
  subdomain: string;
  season: string;
  commissioner: string;
  teams: {
    id: string;
    name: string;
    division: string;
    manager: string;
    managerEmail: string;
    paidStatus: "Paid" | "Pending" | "Partial";
    amountDue: number;
    amountPaid: number;
    roster: {
      id: string;
      name: string;
      number: number;
      position: string;
      registered: boolean;
      waiverStatus: "Signed" | "Pending";
      paymentStatus: "Paid" | "Outstanding";
    }[];
  }[];
  divisions: {
    id: string;
    name: string;
    description: string;
    teamCount: number;
  }[];
  schedule: {
    id: string;
    date: string;
    time: string;
    homeTeam: string;
    awayTeam: string;
    venue: string;
    status: "scheduled" | "final" | "in_progress";
  }[];
}

const LEAGUES_DATA: Record<string, LeagueMeta> = {
  "60000000-0000-4000-8000-000000000001": {
    id: "60000000-0000-4000-8000-000000000001",
    name: "Bangladesh Hockey League (BHL)",
    domain: "bhl.com",
    subdomain: "league1.plaionn.brittosoft.online",
    season: "Winter 2026",
    commissioner: "commissioner@bhl.com",
    divisions: [
      { id: "d1", name: "Premier Division", description: "Top-tier national championship division", teamCount: 4 },
      { id: "d2", name: "National Cup Division", description: "Knockout cup and development circuit", teamCount: 4 },
    ],
    teams: [
      {
        id: "t1",
        name: "Dhaka Gladiators",
        division: "Premier Division",
        manager: "Tanvir Ahmed",
        managerEmail: "tanvir@gladiators.bd",
        paidStatus: "Paid",
        amountDue: 1200,
        amountPaid: 1200,
        roster: [
          { id: "p1", name: "Shadhin Rahman", number: 10, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p2", name: "Arif Hossain", number: 7, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p3", name: "Kamal Hasan", number: 1, position: "G", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p4", name: "Rasel Mahmud", number: 24, position: "D", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
      {
        id: "t2",
        name: "Chittagong Warriors",
        division: "Premier Division",
        manager: "Mahfuz Khan",
        managerEmail: "mahfuz@warriors.bd",
        paidStatus: "Paid",
        amountDue: 1200,
        amountPaid: 1200,
        roster: [
          { id: "p5", name: "Sohail Rana", number: 19, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p6", name: "Tareq Aziz", number: 30, position: "G", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p7", name: "Zubair Ahmed", number: 4, position: "D", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
      {
        id: "t3",
        name: "Sylhet Strikers",
        division: "Premier Division",
        manager: "Nafiz Islam",
        managerEmail: "nafiz@strikers.bd",
        paidStatus: "Partial",
        amountDue: 1200,
        amountPaid: 800,
        roster: [
          { id: "p8", name: "Habibul Bashar", number: 9, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p9", name: "Imran Nazir", number: 17, position: "D", registered: true, waiverStatus: "Pending", paymentStatus: "Outstanding" },
        ],
      },
      {
        id: "t4",
        name: "Rajshahi Rangers",
        division: "Premier Division",
        manager: "Faisal Kabir",
        managerEmail: "faisal@rangers.bd",
        paidStatus: "Pending",
        amountDue: 1200,
        amountPaid: 0,
        roster: [
          { id: "p10", name: "Sakib Al Hasan", number: 75, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Outstanding" },
          { id: "p11", name: "Tamim Iqbal", number: 28, position: "F", registered: true, waiverStatus: "Pending", paymentStatus: "Outstanding" },
        ],
      },
    ],
    schedule: [
      { id: "s1", date: "Fri, Dec 5, 2026", time: "7:00 PM", homeTeam: "Dhaka Gladiators", awayTeam: "Chittagong Warriors", venue: "National Stadium - Rink 1", status: "scheduled" },
      { id: "s2", date: "Sat, Dec 6, 2026", time: "8:30 PM", homeTeam: "Sylhet Strikers", awayTeam: "Rajshahi Rangers", venue: "National Stadium - Rink 2", status: "scheduled" },
    ],
  },
  "60000000-0000-4000-8000-000000000003": {
    id: "60000000-0000-4000-8000-000000000003",
    name: "Wave Adult Hockey League (WAHL)",
    domain: "waveadulthockeyleague.ca",
    subdomain: "league2.plaionn.brittosoft.online",
    season: "Winter 2026",
    commissioner: "league@wavehockey.ca",
    divisions: [
      { id: "d3", name: "Monday Over 40", description: "Competitive masters hockey (Ages 40+)", teamCount: 4 },
      { id: "d4", name: "Tuesday Over 50", description: "Recreational veteran division (Ages 50+)", teamCount: 4 },
      { id: "d5", name: "Adult Rec Division A", description: "Open adult non-checking hockey", teamCount: 4 },
    ],
    teams: [
      {
        id: "t5",
        name: "Harbour Wolves",
        division: "Monday Over 40",
        manager: "Alexander Reed",
        managerEmail: "reed@wolveshockey.ca",
        paidStatus: "Paid",
        amountDue: 1500,
        amountPaid: 1500,
        roster: [
          { id: "p12", name: "David Lindqvist", number: 1, position: "G", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p13", name: "Connor Hayes", number: 11, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p14", name: "Liam Gallagher", number: 12, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
      {
        id: "t6",
        name: "Wave Breakers",
        division: "Monday Over 40",
        manager: "Tom Vance",
        managerEmail: "tom@wavebreakers.ca",
        paidStatus: "Paid",
        amountDue: 1500,
        amountPaid: 1500,
        roster: [
          { id: "p15", name: "Mark Wilson", number: 8, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p16", name: "Brian Campbell", number: 22, position: "D", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
      {
        id: "t7",
        name: "Thunder Puck",
        division: "Tuesday Over 50",
        manager: "Craig Watson",
        managerEmail: "craig@thunderpuck.ca",
        paidStatus: "Partial",
        amountDue: 1500,
        amountPaid: 1000,
        roster: [
          { id: "p17", name: "Paul Henderson", number: 19, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p18", name: "Greg Adams", number: 30, position: "G", registered: true, waiverStatus: "Signed", paymentStatus: "Outstanding" },
        ],
      },
      {
        id: "t8",
        name: "Black Bull Mud Dawgs",
        division: "Tuesday Over 50",
        manager: "Eric Larson",
        managerEmail: "eric@muddawgs.ca",
        paidStatus: "Pending",
        amountDue: 1500,
        amountPaid: 0,
        roster: [
          { id: "p19", name: "Dave Schultz", number: 15, position: "F", registered: true, waiverStatus: "Pending", paymentStatus: "Outstanding" },
        ],
      },
    ],
    schedule: [
      { id: "s3", date: "Mon, Dec 1, 2026", time: "8:00 PM", homeTeam: "Harbour Wolves", awayTeam: "Wave Breakers", venue: "Metro Rink - Rink 1", status: "scheduled" },
      { id: "s4", date: "Tue, Dec 2, 2026", time: "9:00 PM", homeTeam: "Thunder Puck", awayTeam: "Black Bull Mud Dawgs", venue: "Metro Rink - Rink 2", status: "scheduled" },
    ],
  },
  "60000000-0000-4000-8000-000000000004": {
    id: "60000000-0000-4000-8000-000000000004",
    name: "Canada Hockey League (CHL)",
    domain: "chl.com",
    subdomain: "league3.plaionn.brittosoft.online",
    season: "Winter 2026",
    commissioner: "admin@chl.com",
    divisions: [
      { id: "d6", name: "Eastern Conference", description: "Ontario & Quebec elite circuit", teamCount: 8 },
      { id: "d7", name: "Western Conference", description: "Western Canadian clubs", teamCount: 8 },
    ],
    teams: [
      {
        id: "t9",
        name: "Ottawa Titans",
        division: "Eastern Conference",
        manager: "Jean-Pierre Roy",
        managerEmail: "jp@titans.ca",
        paidStatus: "Paid",
        amountDue: 2000,
        amountPaid: 2000,
        roster: [
          { id: "p20", name: "Nathan MacKinnon", number: 29, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
          { id: "p21", name: "Cale Makar", number: 8, position: "D", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
      {
        id: "t10",
        name: "Montreal Royals",
        division: "Eastern Conference",
        manager: "Michel Tremblay",
        managerEmail: "tremblay@royals.ca",
        paidStatus: "Paid",
        amountDue: 2000,
        amountPaid: 2000,
        roster: [
          { id: "p22", name: "Guy Lafleur", number: 10, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
    ],
    schedule: [
      { id: "s5", date: "Fri, Dec 5, 2026", time: "7:30 PM", homeTeam: "Ottawa Titans", awayTeam: "Montreal Royals", venue: "Capital Arena - Rink A", status: "scheduled" },
    ],
  },
  "60000000-0000-4000-8000-000000000005": {
    id: "60000000-0000-4000-8000-000000000005",
    name: "Italy Hockey League (IHL)",
    domain: "ihl.com",
    subdomain: "league4.plaionn.brittosoft.online",
    season: "Winter 2026",
    commissioner: "direttore@ihl.com",
    divisions: [
      { id: "d8", name: "Serie A1", description: "Italian top division", teamCount: 4 },
      { id: "d9", name: "Serie A2", description: "Developmental regional division", teamCount: 2 },
    ],
    teams: [
      {
        id: "t11",
        name: "Milano Vipers",
        division: "Serie A1",
        manager: "Marco Rossi",
        managerEmail: "rossi@vipers.it",
        paidStatus: "Paid",
        amountDue: 1800,
        amountPaid: 1800,
        roster: [
          { id: "p23", name: "Luca Frigo", number: 93, position: "F", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
      {
        id: "t12",
        name: "Roma Gladiators",
        division: "Serie A1",
        manager: "Enrico Fermi",
        managerEmail: "fermi@gladiators.it",
        paidStatus: "Paid",
        amountDue: 1800,
        amountPaid: 1800,
        roster: [
          { id: "p24", name: "Alessandro Gatti", number: 14, position: "D", registered: true, waiverStatus: "Signed", paymentStatus: "Paid" },
        ],
      },
    ],
    schedule: [
      { id: "s6", date: "Fri, Dec 5, 2026", time: "8:00 PM", homeTeam: "Milano Vipers", awayTeam: "Roma Gladiators", venue: "PalaOlimpico - Rink 1", status: "scheduled" },
    ],
  },
};

export default async function LeagueBackendPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const league = LEAGUES_DATA[leagueId] || LEAGUES_DATA["60000000-0000-4000-8000-000000000001"];

  if (!league) {
    notFound();
  }

  return (
    <main id="main" className="public-portal-container" style={{ paddingBottom: "60px" }}>
      <LeagueBackendClient initialLeague={league} />
    </main>
  );
}

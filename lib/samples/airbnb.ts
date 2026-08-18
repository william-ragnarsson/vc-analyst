/**
 * The sample deck offered on the homepage to visitors who don't have a pitch
 * deck to hand.
 *
 * Why the text is committed rather than extracted at request time: the source
 * PDF is 29 image-only pages (3.9MB, zero embedded text — `unpdf` returns 0
 * characters), so the normal path in `lib/pdf/extract.ts` would fall through to
 * the Claude vision-OCR extractor on every single click. That's tens of seconds
 * and real spend on the one control designed to attract the most traffic. With
 * the text pre-extracted, `/api/analyze` skips extraction entirely and the run
 * is the genuine pipeline from `loadPlaybook()` onward.
 *
 * Regenerating `deckText`: transcribe `public/sample-decks/airbnb-2008-seed-deck.pdf`
 * with the same instruction the OCR extractor uses (`OCR_INSTRUCTION` in
 * `lib/pdf/extractors/instruction.ts`), then apply the two edits below by hand.
 *
 * Two deliberate departures from a raw transcription:
 *  1. The Slidebean wrapper pages (1, 28, 29 — laptop mockup, "redesigned in
 *     slidebean.com", the discount-code outro) are dropped. Left in, the engine
 *     analyses Slidebean instead of Airbnb.
 *  2. Slides that are click-by-click build-ups of the same layout (Solution,
 *     Business Model, Market Adoption, Financial) appear once, in their final
 *     state. The engine reads the deck as prose, and three near-identical copies
 *     of one slide read as repetition rather than as a build.
 */

export interface SampleDeck {
  /** Stable id — doubles as the history key and the /due-diligence/<id> slug. */
  id: string;
  /** Shown in the prompt, and the report's fallback name. */
  label: string;
  /** Public path to the source PDF, for the "view the deck" link. */
  pdfPath: string;
  /** Pre-extracted deck text — see the regeneration note above. */
  deckText: string;
}

export const AIRBNB_SAMPLE: SampleDeck = {
  id: "sample-airbnb-2008",
  label: "Airbnb's 2008 seed deck",
  pdfPath: "/sample-decks/airbnb-2008-seed-deck.pdf",
  deckText: `airbnb Pitch Deck
Book rooms with locals rather than hotels

Problem
Price is an important concern for customer booking travel online.
Hotels leave you disconnected from the city and its culture.
No easy way exists to book a room with a local or become a host.

Solution: A web platform where users can rent out their space to host travelers to
Save Money when traveling
Make Money when hosting
Share Culture local connection to the city

Market Validation
couchsurfing.com — 670,000 TOTAL USERS
craigslist.com — 17,000 TEMPORARY HOUSING LISTINGS
In SF & and NYC from 7/09 to 7/16

Market Size
2 Billion + Trips Booked (WorldWide) — Total Available Market
560 Million + Budget&Online — Serviceable Available Market
84 Million Trips w/AirBnB — Share of Market
15% of available market
*source: Travel Industry Assn. of America and World Tourism Organization.
**source: comScore

Product

Search by city

Review listings

Book it!

Business Model: we take a 10% commission on each transaction
$84 MILLION DOLLARS — Trips with AirBnB, 15% of Available Market
$25 AVERAGE FEE — $80/night for 3 nights
$200 MILLION DOLLARS — Revenue, Projected by 2011

Market Adoption
EVENTS — target events monthly
Octoberfest (6M)
Cebit (700,000)
Summerfest (1M)
Eurocup (3M+)
MardiGras (800,000)
PARTNERSHIPS — cheap/alternative travel
GoLoco
Kayak
Orbitz
CRAIGSLIST — dual posting feature

Competition
AFFORDABLE / EXPENSIVE
OFFLINE TRANSACTION / ONLINE TRANSACTION
airbnb: affordable, online transaction
Competitors occupy the other three quadrants.

Competitive Advantage
First to Market — for transaction-based temporary housing site
Host Incentive — they can make money over couchsurfing.com
List Once — hosts post one time vs. daily on craigslist
Ease of Use — search by price, location & check-in/check-out dates
Profiles — browse host profiles, and book in 3 clicks
Design and Brand — memorable name will launch at historic DNC to gain share of mind

Team
Joe Gebbia — User Interface & PR. Holds a patent for his product, Critbuns(R). Has dual BFA's in graphic design and industrial design from Rhode Island School of Design (RISD).
Brian Chesky — Business Development & Brand. Founder of Brian Chesky Inc, industrial design consultant. Has a BFA in industrial design from RISD.
Nathan Blecharcyk — Developer. Created Facebook Apps "Your neighbors" (75,000 users). Computer Science from Harvard Nate. Worked @ Microsoft, OPNET Technologies and Batiq.
Michael Seibel, Advisor — Michael is the CEO and Co-founder of justin.tv, a San Francisco based venture funded startup that delivers live video to the Internet.

Press
"AirBed & Breakfast is a fun approach to CouchSurfing" — Webware
"A cool alternative to a boring evening in a hotel room" — Mashable
"Think of it a Craigslist meets hotels.com, but a lot less crappy." — Josh Spear

User Testimonials
"AirBed & Breakfast freaking rocks!" — Josue F, Washington DC
"A complete success! It is easy to use and made me money." — Emily M, Austin TX
"It's about the ideas, the interactions, the people. You don't get that in a hotel room." — Dan A, Ontario, Canada.

Financial
We are looking for 12 months financing to reach 80,000 transactions on AirBed&Breakfast
$500K Angel Round — initial investment opportunity
80K Trips w/AirB&B — avg $25 free
$2M Revenue — over 12 months`,
};

/** Looks up a sample deck by id. Returns null for anything unrecognised. */
export function getSampleDeck(id: string): SampleDeck | null {
  return id === AIRBNB_SAMPLE.id ? AIRBNB_SAMPLE : null;
}

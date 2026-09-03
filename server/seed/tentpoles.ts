import type { InsiderTip } from "@shared/schema";

/**
 * The Des Moines calendar locals actually plan around.
 *
 * Dates are stored as a typical month and day rather than a fixed year, and the
 * next occurrence is computed at seed time. Hard-coding "August 13 2026" means
 * every guide is stale by September; an anchor plus a roll-forward rule keeps
 * them permanently useful.
 *
 * Anchors are approximate by design. Most of these move by a few days each year
 * and publish exact dates only a few months out, so the guide says "Mid-August"
 * and the countdown is honest about being an estimate until the organizer
 * confirms.
 */

export interface TentpoleSeed {
  slug: string;
  name: string;
  description: string;
  typicalMonth: string;
  /** Approximate start, as month (1-12) and day. */
  anchorStart: { month: number; day: number };
  /** Approximate end. Same day as the start for single-day events. */
  anchorEnd: { month: number; day: number };
  officialUrl: string;
  neighborhoodSlug?: string;
  insiderTips: InsiderTip[];
  whatsNewThisYear?: string;
  isFree: boolean;
  isKidFriendly: boolean;
}

export const seedTentpoles: TentpoleSeed[] = [
  {
    slug: "downtown-farmers-market",
    name: "Downtown Farmers' Market",
    description:
      "Four blocks of the Historic Court District close every Saturday morning from May through October for one of the largest farmers markets in the country. Around 300 vendors, most of them Iowa growers and makers.",
    typicalMonth: "Saturdays, May through October",
    anchorStart: { month: 5, day: 2 },
    anchorEnd: { month: 10, day: 31 },
    officialUrl: "https://www.desmoinesfarmersmarket.com/",
    neighborhoodSlug: "court-avenue",
    insiderTips: [
      {
        title: "Go before 8am or after 10:30",
        body: "The middle two hours are shoulder-to-shoulder. Early is for produce, late is for parking.",
      },
      {
        title: "Park in a ramp, not on the street",
        body: "The Court Avenue and Second Street ramps are a short walk and far less frustrating than circling for a meter.",
      },
      {
        title: "Bring cash and a bag",
        body: "Most vendors take cards now, but the smaller stands still prefer cash and nobody hands out bags.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "iowa-state-fair",
    name: "Iowa State Fair",
    description:
      "Eleven days on the east side, and the single biggest thing that happens in Iowa all year. The Butter Cow, the Grand Concourse, food on a stick, and a livestock complex most visitors never reach.",
    typicalMonth: "Mid-August",
    anchorStart: { month: 8, day: 13 },
    anchorEnd: { month: 8, day: 23 },
    officialUrl: "https://www.iowastatefair.org/",
    insiderTips: [
      {
        title: "Park at the shuttle lots",
        body: "Neighborhood yards charge more and trap you in. The official park-and-ride from the east side lots is faster leaving than arriving.",
      },
      {
        title: "Weekdays are a different fair",
        body: "The second Tuesday is the calmest day. Weekend afternoons on the Grand Concourse are close to unwalkable.",
      },
      {
        title: "The livestock barns are the actual fair",
        body: "Most people never leave the food corridor. The cattle barn and the sheep barn are quieter, cooler and more interesting.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
  {
    slug: "drake-relays",
    name: "Drake Relays",
    description:
      "One of the oldest track meets in the country, run on the blue oval at Drake Stadium since 1910. Olympians and high schoolers compete on the same track in the same week.",
    typicalMonth: "Late April",
    anchorStart: { month: 4, day: 22 },
    anchorEnd: { month: 4, day: 26 },
    officialUrl: "https://godrakebulldogs.com/sports/drake-relays",
    neighborhoodSlug: "drake",
    insiderTips: [
      {
        title: "The street events are free",
        body: "The pole vault and shot put move to downtown and Franklin Avenue earlier in the week, and cost nothing to watch up close.",
      },
      {
        title: "Saturday is the big day",
        body: "Thursday and Friday are cheaper and far easier to get into if you just want to see the stadium.",
      },
      {
        title: "Park south of campus and walk",
        body: "The lots right by the stadium fill early and empty slowly.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
  {
    slug: "80-35-music-festival",
    name: "80/35 Music Festival",
    description:
      "Downtown's summer music festival, named for the two interstates that cross here. National headliners on the main stage in Western Gateway, with free stages around it.",
    typicalMonth: "Early to mid-July",
    anchorStart: { month: 7, day: 10 },
    anchorEnd: { month: 7, day: 11 },
    officialUrl: "https://80235.org/",
    neighborhoodSlug: "western-gateway",
    insiderTips: [
      {
        title: "There is a free stage",
        body: "You do not need a ticket to see a good chunk of the lineup. The paid wristband is for the main stage.",
      },
      {
        title: "It is hot and there is no shade",
        body: "The sculpture park is open lawn in July. Bring water and expect to sweat through the headliner.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
  {
    slug: "hinterland-music-festival",
    name: "Hinterland Music Festival",
    description:
      "Four days of mostly indie and Americana acts in a natural amphitheater at Avenue of the Saints in St. Charles, about forty minutes south of the metro. Camping is half the point.",
    typicalMonth: "Early August",
    anchorStart: { month: 8, day: 1 },
    anchorEnd: { month: 8, day: 4 },
    officialUrl: "https://hinterlandiowa.com/",
    insiderTips: [
      {
        title: "Camping sells out before the lineup drops",
        body: "Regulars buy passes the week they go on sale, months before anyone knows who is playing.",
      },
      {
        title: "It is a field in Iowa in August",
        body: "Sun, mud or both. Bring boots and sunscreen and assume you will need each.",
      },
    ],
    isFree: false,
    isKidFriendly: false,
  },
  {
    slug: "world-food-and-music-festival",
    name: "World Food & Music Festival",
    description:
      "Three days in the East Village where dozens of local restaurants and immigrant-run kitchens sell small plates from around the world, with music running alongside.",
    typicalMonth: "Mid-September",
    anchorStart: { month: 9, day: 18 },
    anchorEnd: { month: 9, day: 20 },
    officialUrl: "https://www.dsmpartnership.com/worldfoodandmusicfestival",
    neighborhoodSlug: "east-village",
    insiderTips: [
      {
        title: "Go hungry and go in a group",
        body: "Portions are small on purpose. Split everything and you will try three times as much.",
      },
      {
        title: "Friday night is the least crowded",
        body: "Saturday afternoon lines at the popular stands run twenty minutes deep.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "des-moines-arts-festival",
    name: "Des Moines Arts Festival",
    description:
      "A juried art fair through the Western Gateway and around the sculpture park, consistently ranked among the best in the country. Free to walk in.",
    typicalMonth: "Late June",
    anchorStart: { month: 6, day: 26 },
    anchorEnd: { month: 6, day: 28 },
    officialUrl: "https://desmoinesartsfestival.org/",
    neighborhoodSlug: "western-gateway",
    insiderTips: [
      {
        title: "Admission is free",
        body: "People assume a festival this size charges. It does not. Bring money for art, not entry.",
      },
      {
        title: "Sunday afternoon is for deals",
        body: "Artists would rather sell a piece than pack it, so late Sunday is when prices move.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "ragbrai",
    name: "RAGBRAI",
    description:
      "The week-long ride across Iowa, west to east, with a different overnight town each night. Des Moines is a regular stop and the route is announced each winter.",
    typicalMonth: "Late July",
    anchorStart: { month: 7, day: 19 },
    anchorEnd: { month: 7, day: 26 },
    officialUrl: "https://ragbrai.com/",
    insiderTips: [
      {
        title: "You do not have to ride the whole week",
        body: "Day passes are common, and plenty of locals ride only the leg that passes nearest home.",
      },
      {
        title: "Check the route before booking anything",
        body: "The overnight towns change every year and are announced in late January.",
      },
    ],
    isFree: false,
    isKidFriendly: false,
  },
  {
    slug: "capital-city-pride",
    name: "Capital City Pride",
    description:
      "Des Moines' Pride festival and parade, centered on the East Village and downtown, with a week of associated events leading up to the main weekend.",
    typicalMonth: "Early June",
    anchorStart: { month: 6, day: 6 },
    anchorEnd: { month: 6, day: 8 },
    officialUrl: "https://capitalcitypride.org/",
    neighborhoodSlug: "east-village",
    insiderTips: [
      {
        title: "The parade route fills early",
        body: "Locust and Grand fill an hour before step-off. Anywhere past the Capitol end stays open longer.",
      },
      {
        title: "There is a family area",
        body: "The festival grounds have a kids' section well away from the main stage volume.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "celebrasian",
    name: "CelebrAsian Heritage Festival",
    description:
      "Iowa's Asian heritage festival at Western Gateway Park, with food villages organized by country, performances and a dragon boat presence.",
    typicalMonth: "Late May",
    anchorStart: { month: 5, day: 22 },
    anchorEnd: { month: 5, day: 23 },
    officialUrl: "https://www.iowaasianalliance.org/celebrasian",
    neighborhoodSlug: "western-gateway",
    insiderTips: [
      {
        title: "Come for the food villages",
        body: "Each country runs its own booth cluster, and several are only open this one weekend a year.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "latino-heritage-festival",
    name: "Latino Heritage Festival",
    description:
      "A weekend of food, music and dance at Western Gateway celebrating Latin American cultures, one of the larger cultural festivals in the state.",
    typicalMonth: "Late September",
    anchorStart: { month: 9, day: 26 },
    anchorEnd: { month: 9, day: 27 },
    officialUrl: "https://latinoheritagefestival.org/",
    neighborhoodSlug: "western-gateway",
    insiderTips: [
      {
        title: "The dance performances are scheduled",
        body: "Check the stage times before you go; the folkloric groups perform in blocks rather than continuously.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "iowa-cubs-opening-day",
    name: "Iowa Cubs Opening Day",
    description:
      "The start of the Triple-A season at Principal Park, with the downtown skyline over the outfield. The unofficial first day of spring in Des Moines.",
    typicalMonth: "Early April",
    anchorStart: { month: 4, day: 4 },
    anchorEnd: { month: 4, day: 4 },
    officialUrl: "https://www.milb.com/iowa",
    neighborhoodSlug: "downtown",
    insiderTips: [
      {
        title: "Dress for February, not April",
        body: "Opening day is regularly in the forties with wind off the river. Long-time fans bring blankets.",
      },
      {
        title: "Berm seats are the cheap ones",
        body: "The outfield grass berm is the best value in the park and fine with kids who will not sit still.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
  {
    slug: "winefest-des-moines",
    name: "Winefest Des Moines",
    description:
      "A week of tastings, dinners and classes across the metro, ending in a large grand tasting downtown.",
    typicalMonth: "Early June",
    anchorStart: { month: 6, day: 1 },
    anchorEnd: { month: 6, day: 7 },
    officialUrl: "https://www.winefestdesmoines.com/",
    neighborhoodSlug: "downtown",
    insiderTips: [
      {
        title: "The smaller dinners sell out first",
        body: "The grand tasting is easy to get into. The winemaker dinners are the ones that go.",
      },
    ],
    isFree: false,
    isKidFriendly: false,
  },
  {
    slug: "blue-ribbon-bacon-festival",
    name: "Blue Ribbon Bacon Festival",
    description:
      "An indoor winter festival built entirely around bacon, which is more Iowa than it sounds. Tickets go on sale months ahead and sell fast.",
    typicalMonth: "Late February",
    anchorStart: { month: 2, day: 21 },
    anchorEnd: { month: 2, day: 21 },
    officialUrl: "https://blueribbonbaconfest.com/",
    insiderTips: [
      {
        title: "Tickets are the hard part",
        body: "The on-sale date matters more than the event date. It regularly sells out the day tickets drop.",
      },
    ],
    isFree: false,
    isKidFriendly: false,
  },
  {
    slug: "principal-charity-classic",
    name: "Principal Charity Classic",
    description:
      "A PGA Tour Champions event at Wakonda Club, and one of the larger charity fundraisers in the state.",
    typicalMonth: "Early June",
    anchorStart: { month: 6, day: 5 },
    anchorEnd: { month: 6, day: 7 },
    officialUrl: "https://www.principalcharityclassic.com/",
    neighborhoodSlug: "south-side",
    insiderTips: [
      {
        title: "Kids get in free",
        body: "Under-18 admission is free with a ticketed adult, which makes it a cheap outing.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
  {
    slug: "juneteenth-celebration",
    name: "Juneteenth Celebration",
    description:
      "Des Moines' Juneteenth events center on the north side, with a parade, music and community programming around June 19.",
    typicalMonth: "Mid-June",
    anchorStart: { month: 6, day: 19 },
    anchorEnd: { month: 6, day: 19 },
    officialUrl: "https://www.dsm.city/",
    neighborhoodSlug: "highland-park",
    insiderTips: [
      {
        title: "Programming runs all week",
        body: "The nineteenth is the anchor, but events start several days earlier across the north side.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "oktoberfest-des-moines",
    name: "Oktoberfest Des Moines",
    description:
      "German beer, food and music in the Historic Court District, timed to the end of the outdoor season.",
    typicalMonth: "Late September",
    anchorStart: { month: 9, day: 26 },
    anchorEnd: { month: 9, day: 27 },
    officialUrl: "https://www.desmoinesoktoberfest.com/",
    neighborhoodSlug: "court-avenue",
    insiderTips: [
      {
        title: "Buy the stein package",
        body: "If you plan on more than two beers, the stein and pour package is cheaper than paying per drink.",
      },
    ],
    isFree: false,
    isKidFriendly: false,
  },
  {
    slug: "christkindlmarket-des-moines",
    name: "Christkindlmarket Des Moines",
    description:
      "A German-style Christmas market of wooden stalls, mulled wine and local makers, held downtown in early December.",
    typicalMonth: "Early December",
    anchorStart: { month: 12, day: 5 },
    anchorEnd: { month: 12, day: 7 },
    officialUrl: "https://www.christkindlmarketdsm.com/",
    neighborhoodSlug: "western-gateway",
    insiderTips: [
      {
        title: "It is outdoors in December",
        body: "The stalls are open air. Dress as if you are standing still outside for two hours, because you are.",
      },
      {
        title: "Weeknights are calm",
        body: "The first Saturday is the busiest few hours of the whole market.",
      },
    ],
    isFree: true,
    isKidFriendly: true,
  },
  {
    slug: "iowa-high-school-state-wrestling",
    name: "Iowa High School State Wrestling",
    description:
      "Three days that fill Wells Fargo Arena and most of the downtown hotels. Wrestling is a genuine cultural institution in Iowa, and this is its championship.",
    typicalMonth: "Mid-February",
    anchorStart: { month: 2, day: 19 },
    anchorEnd: { month: 2, day: 21 },
    officialUrl: "https://www.iahsaa.org/wrestling/",
    neighborhoodSlug: "downtown",
    insiderTips: [
      {
        title: "Book a hotel in autumn, not February",
        body: "Downtown sells out months ahead. This is the single busiest hotel weekend of the Des Moines winter.",
      },
      {
        title: "Session tickets beat all-session",
        body: "Unless you are following a specific wrestler through the bracket, single sessions are far cheaper.",
      },
      {
        title: "Use the skywalk",
        body: "It is February. You can get from most downtown ramps to the arena without going outside.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
  {
    slug: "state-basketball-tournaments",
    name: "Girls' and Boys' State Basketball",
    description:
      "Back-to-back state basketball tournaments at Wells Fargo Arena, drawing small towns from across Iowa into downtown for two straight weeks.",
    typicalMonth: "Late February into March",
    anchorStart: { month: 2, day: 25 },
    anchorEnd: { month: 3, day: 14 },
    officialUrl: "https://www.ighsau.org/",
    neighborhoodSlug: "downtown",
    insiderTips: [
      {
        title: "The girls' tournament comes first",
        body: "It runs the week before the boys', and the early rounds are the easiest tickets of either.",
      },
      {
        title: "Downtown restaurants are slammed at halftime",
        body: "Eat between sessions rather than during the gap everyone else uses.",
      },
    ],
    isFree: false,
    isKidFriendly: true,
  },
];

/**
 * Resolve a seed's anchors to the next occurrence.
 *
 * If this year's window has already ended, roll to next year. A multi-day event
 * that is currently under way keeps this year's dates so the guide reads
 * "on now" rather than jumping twelve months ahead.
 *
 * Windows that cross the new year (the basketball tournaments run late February
 * into March, but Christkindlmarket-style December-to-January events would too)
 * are handled by pushing the end into the following year when it sorts before
 * the start.
 */
export function resolveNextOccurrence(
  seed: TentpoleSeed,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const build = (year: number) => {
    const start = new Date(year, seed.anchorStart.month - 1, seed.anchorStart.day);
    let end = new Date(year, seed.anchorEnd.month - 1, seed.anchorEnd.day, 23, 59, 59);
    // A window ending "before" it starts means it wraps into the next year.
    if (end < start) {
      end = new Date(year + 1, seed.anchorEnd.month - 1, seed.anchorEnd.day, 23, 59, 59);
    }
    return { start, end };
  };

  const thisYear = build(now.getFullYear());
  // Still running, or yet to come: this year's dates are the answer.
  if (thisYear.end >= now) return thisYear;

  return build(now.getFullYear() + 1);
}

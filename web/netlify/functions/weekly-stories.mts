// Generates "stories" (250-300 word recaps) for every final game that
// doesn't have one yet, strictly grounded in real DB data -- see
// _shared/storiesCore.ts for the facts/prompt contract. Auto-publishes
// immediately (see insertStory's comment for why) -- /admin/stories is
// a post-hoc moderation view now, not a gate.
//
// CHANGED 2026-09-20: used to gate on mostRecentFinalWeek() (the whole
// week had to be done, so nothing generated until Monday Night
// finished), running once a week. Explicit ask: recaps should replace
// each other on the home page as individual games complete, not wait
// for the full week -- so this now scans every final game in the
// season each run (allFinalGamesInSeason()) and relies on
// storyAlreadyExists() to skip anything already covered, and the cron
// runs every 3 hours instead of weekly to actually catch newly-final
// games promptly. Same DST caveat as this codebase's other cron
// schedules (UTC, assumes EDT/UTC-4).
import {
  currentSeasonYear,
  allFinalGamesInSeason,
  storyAlreadyExists,
  buildGameFacts,
  generateStory,
  insertStory,
} from "./_shared/storiesCore";

export const config = { schedule: "0 */3 * * *" };

export default async (): Promise<Response> => {
  const season = currentSeasonYear();
  const games = await allFinalGamesInSeason(season);
  console.log(`Season ${season} -- ${games.length} final game(s) across all weeks.`);

  let created = 0;
  let skippedExisting = 0;
  let skippedNoStory = 0;

  for (const game of games) {
    if (await storyAlreadyExists(game.universal_game_id)) {
      skippedExisting++;
      continue;
    }

    const facts = await buildGameFacts(game, season);
    const story = await generateStory(facts);
    if (!story) {
      skippedNoStory++;
      continue;
    }

    await insertStory(facts, story);
    created++;
    console.log(`Published: "${story.headline}"`);
  }

  const summary = `Weekly stories -- created: ${created}, skipped (already exist): ${skippedExisting}, skipped (no story): ${skippedNoStory}`;
  console.log(summary);
  return new Response(summary);
};

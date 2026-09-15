// Generates draft "stories" (short narrative write-ups) for every
// final game in the most recently completed week, strictly grounded
// in real DB data -- see _shared/storiesCore.ts for the facts/prompt
// contract. Drafts land in the `stories` table with status='draft'
// and go nowhere public until an admin approves one at
// /admin/stories (see src/app/admin/stories/page.tsx).
//
// Cron is UTC, same DST caveat as saturday-digest.mts/thursday-digest.mts:
// Tuesday 8am ET = 12:00 UTC, picked to run well after Monday Night
// Football wraps.
import {
  currentSeasonYear,
  mostRecentFinalWeek,
  finalGamesForWeek,
  storyAlreadyExists,
  buildGameFacts,
  generateStory,
  insertDraftStory,
} from "./_shared/storiesCore";

export const config = { schedule: "0 12 * * 2" };

export default async (): Promise<Response> => {
  const season = currentSeasonYear();
  const week = await mostRecentFinalWeek(season);
  if (week === null) {
    console.log(`No fully-final week yet for season ${season} -- nothing to write about.`);
    return new Response("no final week yet");
  }

  const games = await finalGamesForWeek(season, week);
  console.log(`Season ${season}, Week ${week} -- ${games.length} final game(s).`);

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

    await insertDraftStory(facts, story);
    created++;
    console.log(`Drafted: "${story.headline}"`);
  }

  const summary = `Weekly stories -- created: ${created}, skipped (already exist): ${skippedExisting}, skipped (no story): ${skippedNoStory}`;
  console.log(summary);
  return new Response(summary);
};

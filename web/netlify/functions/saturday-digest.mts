// Follow-up to thursday-digest.mts -- NOT unconditional. Only emails
// a user about a followed team's game whose market spread has moved
// more than SPREAD_MOVE_THRESHOLD points since the Thursday send for
// that exact user+game. Users with zero qualifying games get no
// email at all -- there is no "nothing changed" version of this
// digest.
//
// A game with no Thursday record for this user (e.g. they started
// following a team after Thursday's send) is skipped, not treated as
// "moved infinity points" -- there's no real baseline to compare
// against yet.
//
// Cron is UTC, hand-picked for the current EDT offset (Saturday 7pm
// ET = 23:00 UTC) -- same DST caveat as thursday-digest.mts.
import {
  SITE_URL,
  THEMES,
  type ThemeName,
  type GameRow,
  teamDisplay,
  formatKickoff,
  currentSeasonWeek,
  subscribedUsers,
  gamesForTeams,
  thursdayBaselineSpreads,
  alreadySentGameIds,
  recordSends,
  sendEmail,
} from "./_shared/digestCore";

export const config = { schedule: "0 23 * * 6" };

const SPREAD_MOVE_THRESHOLD = 5.0;

function buildGameRowHtml(game: GameRow, theme: (typeof THEMES)[ThemeName], move: number): string {
  const homeProb = Math.round(game.home_win_probability * 100);
  const awayProb = 100 - homeProb;
  const kickoff = formatKickoff(game.game_date);
  const link = `${SITE_URL}/game/${game.universal_game_id}`;
  const moveText = `Line moved ${move > 0 ? "+" : ""}${move.toFixed(1)} pts since Thursday`;

  return `
    <tr><td style="padding: 16px; background: ${theme.panel}; border: 1px solid ${theme.border}; border-radius: 8px;">
      <div style="font-size: 12px; color: ${theme.textDim}; letter-spacing: 0.05em; margin-bottom: 4px;">${kickoff}</div>
      <div style="font-size: 11px; color: ${theme.accent}; letter-spacing: 0.03em; margin-bottom: 8px; font-weight: 700;">&#9888; ${moveText}</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color: ${theme.text}; font-weight: 700; font-size: 15px;">${teamDisplay(game.away_team)}</td>
          <td align="right" style="color: ${theme.accent}; font-weight: 700; font-size: 15px;">${awayProb}%</td>
        </tr>
        <tr>
          <td style="color: ${theme.text}; font-weight: 700; font-size: 15px;">${teamDisplay(game.home_team)}</td>
          <td align="right" style="color: ${theme.accent}; font-weight: 700; font-size: 15px;">${homeProb}%</td>
        </tr>
      </table>
      <div style="margin-top: 12px;">
        <a href="${link}" style="color: ${theme.accent}; font-size: 13px; text-decoration: none; font-weight: 600;">View Full Details &rarr;</a>
      </div>
    </td></tr>
    <tr><td style="height: 12px; line-height: 12px;">&nbsp;</td></tr>`;
}

function buildDigestHtml(
  season: number,
  week: number,
  gamesWithMoves: { game: GameRow; move: number }[],
  userTheme: ThemeName
): string {
  const theme = THEMES[userTheme] ?? THEMES.dark;
  const rows = gamesWithMoves.map(({ game, move }) => buildGameRowHtml(game, theme, move)).join("");

  return `
    <div style="background: ${theme.bg}; padding: 32px 16px; font-family: 'Courier New', Courier, monospace;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto;">
        <tr><td style="text-align: center; padding-bottom: 8px;">
          <span style="color: ${theme.accent}; font-size: 20px; font-weight: 700; letter-spacing: 0.05em;">MATRIX<span style="color: ${theme.text};">SPORTS</span></span>
        </td></tr>
        <tr><td style="text-align: center; padding-bottom: 24px; color: ${theme.textDim}; font-size: 13px;">
          Line Movement Alert &middot; ${season} Season Week ${week}
        </td></tr>
        ${rows}
        <tr><td style="text-align: center; padding-top: 16px;">
          <a href="${SITE_URL}/home" style="display: inline-block; background: ${theme.accent}; color: ${theme.accentText}; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px;">View Full Week ${week} Slate</a>
        </td></tr>
        <tr><td style="text-align: center; padding-top: 24px; color: ${theme.textDim}; font-size: 11px;">
          You're getting this because a followed team's line moved more than ${SPREAD_MOVE_THRESHOLD} points since Thursday's email.
          Change your notification preferences anytime in your <a href="${SITE_URL}/profile" style="color: ${theme.textDim};">Profile</a>.
        </td></tr>
      </table>
    </div>`;
}

export default async (): Promise<Response> => {
  const current = await currentSeasonWeek();
  if (!current) {
    console.log("No predictions in the database yet -- nothing to send.");
    return new Response("no predictions yet");
  }
  const { season, week } = current;
  console.log(`Season ${season}, Week ${week} -- spread movement threshold: ${SPREAD_MOVE_THRESHOLD} points`);

  const users = await subscribedUsers();
  console.log(`Subscribed users: ${users.length}`);

  let sent = 0;
  let skippedNoBaseline = 0;
  let skippedNoMovement = 0;
  let failed = 0;

  for (const user of users) {
    const games = await gamesForTeams(season, week, user.notify_teams);
    if (games.length === 0) continue;

    const baseline = await thursdayBaselineSpreads(user.id);
    const alreadySent = await alreadySentGameIds(user.id, "saturday_movement_digest");

    const gamesWithMoves: { game: GameRow; move: number }[] = [];
    for (const g of games) {
      if (alreadySent.has(g.universal_game_id)) continue;
      const thursdaySpread = baseline.get(g.universal_game_id);
      if (thursdaySpread === undefined) {
        skippedNoBaseline++;
        continue;
      }
      const move = g.market_spread_line_current - thursdaySpread;
      if (Math.abs(move) <= SPREAD_MOVE_THRESHOLD) {
        skippedNoMovement++;
        continue;
      }
      gamesWithMoves.push({ game: g, move });
    }

    if (gamesWithMoves.length === 0) continue;

    const html = buildDigestHtml(season, week, gamesWithMoves, (user.theme as ThemeName) ?? "dark");
    const subject = `Line Movement Alert -- Week ${week}`;

    try {
      await sendEmail(user.notification_email, subject, html);
    } catch (err) {
      console.error(`FAILED to send to ${user.notification_email}:`, err);
      failed++;
      continue;
    }

    await recordSends(
      user.id,
      "saturday_movement_digest",
      gamesWithMoves.map(({ game }) => game)
    );
    sent++;
    console.log(`Sent to ${user.notification_email} (${gamesWithMoves.length} game(s) moved)`);
  }

  const summary = `Saturday digest -- sent: ${sent}, skipped (no baseline): ${skippedNoBaseline}, skipped (under threshold): ${skippedNoMovement}, failed: ${failed}`;
  console.log(summary);
  return new Response(summary);
};

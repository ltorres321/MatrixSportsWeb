// Weekly, unconditional email to every user who has notify_win_prob
// enabled and at least one followed team (notify_teams) with a game
// that week -- one digest per user covering every followed team's
// game, not one email per game. Themed to match each recipient's own
// profile.theme.
//
// Records what was sent, INCLUDING the spread AT SEND TIME, in
// notification_sends -- saturday-digest.mts compares against this to
// decide whether a line has moved enough since Thursday to justify a
// follow-up. Idempotent: reruns skip any user+game already recorded.
//
// Cron is UTC and hand-picked for the current EDT offset (Thursday
// 3pm ET = 19:00 UTC) -- bump by 1 hour once DST ends in November,
// and back in spring. Netlify Scheduled Functions only fire for the
// production deploy, never branch/preview deploys, so testing on
// ltorres-1 can never double-email real users.
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
  alreadySentGameIds,
  recordSends,
  sendEmail,
} from "./_shared/digestCore";

export const config = { schedule: "0 19 * * 4" };

function buildGameRowHtml(game: GameRow, theme: (typeof THEMES)[ThemeName]): string {
  const homeProb = Math.round(game.home_win_probability * 100);
  const awayProb = 100 - homeProb;
  const kickoff = formatKickoff(game.game_date);
  const link = `${SITE_URL}/game/${game.universal_game_id}`;

  return `
    <tr><td style="padding: 16px; background: ${theme.panel}; border: 1px solid ${theme.border}; border-radius: 8px;">
      <div style="font-size: 12px; color: ${theme.textDim}; letter-spacing: 0.05em; margin-bottom: 8px;">${kickoff}</div>
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

function buildDigestHtml(season: number, week: number, games: GameRow[], userTheme: ThemeName): string {
  const theme = THEMES[userTheme] ?? THEMES.dark;
  const rows = games.map((g) => buildGameRowHtml(g, theme)).join("");

  return `
    <div style="background: ${theme.bg}; padding: 32px 16px; font-family: 'Courier New', Courier, monospace;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto;">
        <tr><td style="text-align: center; padding-bottom: 8px;">
          <span style="color: ${theme.accent}; font-size: 20px; font-weight: 700; letter-spacing: 0.05em;">MATRIX<span style="color: ${theme.text};">SPORTS</span></span>
        </td></tr>
        <tr><td style="text-align: center; padding-bottom: 24px; color: ${theme.textDim}; font-size: 13px;">
          ${season} Season &middot; Week ${week} predictions for the teams you follow
        </td></tr>
        ${rows}
        <tr><td style="text-align: center; padding-top: 16px;">
          <a href="${SITE_URL}/home" style="display: inline-block; background: ${theme.accent}; color: ${theme.accentText}; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 13px;">View Full Week ${week} Slate</a>
        </td></tr>
        <tr><td style="text-align: center; padding-top: 24px; color: ${theme.textDim}; font-size: 11px;">
          You're receiving this because you're following one or more of these teams.
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
  console.log(`Season ${season}, Week ${week}`);

  const users = await subscribedUsers();
  console.log(`Subscribed users: ${users.length}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    let games = await gamesForTeams(season, week, user.notify_teams);
    if (games.length === 0) {
      skipped++;
      continue;
    }

    const alreadySent = await alreadySentGameIds(user.id, "thursday_digest");
    games = games.filter((g) => !alreadySent.has(g.universal_game_id));
    if (games.length === 0) {
      skipped++;
      continue;
    }

    const html = buildDigestHtml(season, week, games, (user.theme as ThemeName) ?? "dark");
    const subject = `Week ${week} Predictions for Your Teams`;

    try {
      await sendEmail(user.notification_email, subject, html);
    } catch (err) {
      console.error(`FAILED to send to ${user.notification_email}:`, err);
      failed++;
      continue;
    }

    await recordSends(user.id, "thursday_digest", games);
    sent++;
    console.log(`Sent to ${user.notification_email} (${games.length} game(s))`);
  }

  const summary = `Thursday digest -- sent: ${sent}, skipped: ${skipped}, failed: ${failed}`;
  console.log(summary);
  return new Response(summary);
};

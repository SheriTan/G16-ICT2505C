import pool from "../config/db.js";

function mapRowToTeam(row) {
  let github = null;

  if (row.github_repourl && row.github_projurl) {
    const repoMatch = row.github_repourl.match(/github\.com\/([^/]+)\/([^/]+)/);
    const projMatch = row.github_projurl.match(/projects\/(\d+)/);

    github = {
      repoUrl: row.github_repourl,
      projectUrl: row.github_projurl,
      owner: repoMatch ? repoMatch[1] : null,
      repo: repoMatch ? repoMatch[2] : null,
      projectNumber: projMatch ? Number(projMatch[1]) : null,
    };
  }

  return {
    id: String(row.tid),
    teamName: row.teamName,
    platform: row.jira_boardurl ? "jira" : "github",
    jira: row.jira_boardurl ? { boardUrl: row.jira_boardurl } : null,
    github,
  };
}

export async function readTeams() {
  const [rows] = await pool.query("SELECT * FROM team");
  return rows.map(mapRowToTeam);
}

export async function getTeamWithInstructor(teamId) {
  const secretKey = process.env.SECRET_KEY;

  const [rows] = await pool.query(
    `
    SELECT 
      t.tid,
      t.teamName,
      t.jira_boardurl,
      t.github_repourl,
      t.github_projurl,
      i.iid,
      i.email,
      CAST(AES_DECRYPT(i.jiraToken, ?) AS CHAR) AS jiraToken,
      CAST(AES_DECRYPT(i.githubToken, ?) AS CHAR) AS githubToken
    FROM team t
    JOIN instructor i ON t.iid = i.iid
    WHERE t.tid = ?
    `,
    [secretKey, secretKey, teamId]
  );

  if (!rows.length) return null;

  const row = rows[0];
  const team = mapRowToTeam(row);

  team.instructor = {
    id: row.iid,
    email: row.email,
    jiraToken: row.jiraToken || null,
    githubToken: row.githubToken || null,
  };

  return team;
}

export async function addTeam(teamObj, instructorId = 1) {
  const { teamName, jira, github } = teamObj;

  const jiraUrl = jira?.boardUrl || null;
  const githubRepo = github?.repoUrl || null;
  const githubProj = github?.projectUrl || null;

  const [result] = await pool.query(
    `INSERT INTO team (iid, teamName, jira_boardurl, github_repourl, github_projurl)
     VALUES (?, ?, ?, ?, ?)`,
    [instructorId, teamName, jiraUrl, githubRepo, githubProj]
  );

  return {
    id: String(result.insertId),
    ...teamObj,
  };
}

export async function deleteTeam(teamId) {
  const [result] = await pool.query("DELETE FROM team WHERE tid = ?", [teamId]);
  return { deleted: result.affectedRows };
}

export async function bulkAddTeams(teamObjs, instructorId = 1) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const t of teamObjs) {
      await conn.query(
        `INSERT INTO team (iid, teamName, jira_boardurl, github_repourl, github_projurl)
         VALUES (?, ?, ?, ?, ?)`,
        [
          instructorId,
          t.teamName,
          t.jira?.boardUrl || null,
          t.github?.repoUrl || null,
          t.github?.projectUrl || null,
        ]
      );
    }

    await conn.commit();
    return { added: teamObjs.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
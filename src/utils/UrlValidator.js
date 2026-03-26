export function validateJiraBoardUrl(url) {
  // Example: https://sit-workspace.atlassian.net/jira/software/projects/K1/boards/67
  const m = String(url || "").match(/\/projects\/([^/]+)\/boards\/(\d+)/i);
  if (!m) return null;
  return { projectKey: m[1], boardId: Number(m[2]) };
}

export function validateGithubRepoUrl(url) {
  // Example: https://github.com/TheronCJA/Testing-Kanban-1
  const m = String(url || "").match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)(\/)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

export function validateGithubProjectUrl(url) {
  // Example user project: https://github.com/users/TheronCJA/projects/1
  // Example org project:  https://github.com/orgs/ORG/projects/1
  const s = String(url || "");

  let m = s.match(/^https?:\/\/github\.com\/users\/([^/]+)\/projects\/(\d+)(\/)?$/i);
  if (m) return { owner: m[1], projectNumber: Number(m[2]), scope: "user" };

  m = s.match(/^https?:\/\/github\.com\/orgs\/([^/]+)\/projects\/(\d+)(\/)?$/i);
  if (m) return { owner: m[1], projectNumber: Number(m[2]), scope: "org" };

  return null;
}
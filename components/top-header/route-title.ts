export const routeCopy: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Home", subtitle: "Global agreement command center" },
  "/agent-lab": { title: "Agent Lab", subtitle: "Developer workflow diagnostics" }
};

export function routeTitle(pathname: string) {
  if (routeCopy[pathname]) return routeCopy[pathname];
  if (/\/groups\/[^/]+\/proposals/.test(pathname)) {
    return { title: "Splits", subtitle: "Agreement records, blockers, and settlement readiness" };
  }
  if (/\/groups\/[^/]+\/inbox/.test(pathname)) {
    return { title: "Your Share", subtitle: "Participant Review simulation through the sidebar profile switcher" };
  }
  if (/\/groups\/[^/]+\/settings/.test(pathname)) {
    return { title: "Group Settings", subtitle: "Manage members and context" };
  }
  if (/\/groups\/[^/]+/.test(pathname)) {
    return { title: "Group Overview", subtitle: "Readiness, responses, and activity" };
  }
  return { title: "Home", subtitle: "Global agreement command center" };
}

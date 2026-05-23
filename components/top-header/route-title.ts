export const routeCopy: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Home", subtitle: "Global overview across groups" },
  "/agent-lab": { title: "Agent Lab", subtitle: "Developer workflow diagnostics" }
};

export function routeTitle(pathname: string) {
  if (routeCopy[pathname]) return routeCopy[pathname];
  if (/\/groups\/[^/]+\/proposals/.test(pathname)) {
    return { title: "Trip Splits", subtitle: "Review split details and booking readiness" };
  }
  if (/\/groups\/[^/]+\/inbox/.test(pathname)) {
    return { title: "Your Share", subtitle: "Review, accept, or ask for a change" };
  }
  if (/\/groups\/[^/]+\/settings/.test(pathname)) {
    return { title: "Group Settings", subtitle: "Manage members and context" };
  }
  if (/\/groups\/[^/]+/.test(pathname)) {
    return { title: "Group Overview", subtitle: "Readiness, responses, and activity" };
  }
  return { title: "Home", subtitle: "Global overview across groups" };
}

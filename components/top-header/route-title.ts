export const routeCopy: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Home", subtitle: "Global overview across groups" },
  "/agent-lab": { title: "Agent Lab", subtitle: "Developer workflow diagnostics" }
};

export function routeTitle(pathname: string) {
  if (routeCopy[pathname]) return routeCopy[pathname];
  if (/\/groups\/[^/]+\/proposals/.test(pathname)) {
    return { title: "Group Proposals", subtitle: "Review proposal records and settlement actions" };
  }
  if (/\/groups\/[^/]+\/inbox/.test(pathname)) {
    return { title: "Notifications", subtitle: "Review participant updates and responses" };
  }
  if (/\/groups\/[^/]+\/settings/.test(pathname)) {
    return { title: "Group Settings", subtitle: "Manage members and context" };
  }
  if (/\/groups\/[^/]+/.test(pathname)) {
    return { title: "Group Overview", subtitle: "Group-scoped analytics and activity" };
  }
  return { title: "Home", subtitle: "Global overview across groups" };
}

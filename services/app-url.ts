const appBasePath = (process.env.NEXT_PUBLIC_APP_BASEPATH ?? "").replace(/\/$/, "");

// Add the configured application base path to an internal URL.
export function withAppBasePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || !appBasePath) return path;
  if (path === appBasePath || path.startsWith(`${appBasePath}/`) || path.startsWith(`${appBasePath}?`) || path.startsWith(`${appBasePath}#`)) return path;
  return `${appBasePath}${path}`;
}

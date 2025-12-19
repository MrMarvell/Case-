export function getMe(ctx) {
  // With the custom Express server, passport puts the user on req.user.
  const u = ctx?.req?.user || null;
  return u;
}

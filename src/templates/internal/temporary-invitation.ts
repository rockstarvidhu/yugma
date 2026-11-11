/** Internal rendering fixture only. Remove when Track A merges; see docs/template-shell.md. */
export type TemporaryInvitation = {
  names: readonly [string, string];
  welcome: string;
  timeZone: string;
  events: readonly {
    id: string;
    title: string;
    startsAt: string;
    venue: string;
    address: string;
  }[];
};

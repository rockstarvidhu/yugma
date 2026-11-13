type QuickLinksProps = {
  scheduleId?: string;
  venueId?: string;
};

// Supply IDs only for sections rendered on this page.
export function QuickLinks({ scheduleId, venueId }: QuickLinksProps) {
  if (!scheduleId && !venueId) return null;

  return (
    <nav aria-label="Invitation quick links">
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1">
        {scheduleId && (
          <li>
            <a
              className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={`#${scheduleId}`}
            >
              Celebration schedule
            </a>
          </li>
        )}
        {venueId && venueId !== scheduleId && (
          <li>
            <a
              className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              href={`#${venueId}`}
            >
              Venue information
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
}

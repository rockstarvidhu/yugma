export const INVITATION_TIME_ZONE = "Asia/Kolkata" as const;

export type WeddingVenue = {
  name: string;
  address: string;
  mapsUrl: string;
};

export type WeddingEvent = {
  title: string;
  startsAt: string;
  venue?: WeddingVenue;
  location?: string;
  dressCode?: string;
  description?: string;
};

export type Invitation = {
  couple: {
    partnerOne: string;
    partnerTwo: string;
  };
  welcomeNote?: string;
  hosts?: string[];
  coverImage: string;
  events: WeddingEvent[];
};

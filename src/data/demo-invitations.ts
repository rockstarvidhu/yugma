// Fictional zero-photo examples deliberately require no external image service.
import type { Invitation } from "@/types/invitation";

export const singleEventInvitation = {
  couple: { partnerOne: "Aanya Mehta", partnerTwo: "Rohan Iyer" },
  welcomeNote:
    "With full hearts, we invite you to celebrate the beginning of our life together.",
  hosts: ["Anita and Dev Mehta", "Lakshmi and Suresh Iyer"],
  timeZone: "Asia/Kolkata",
  events: [
    {
      id: "evt_7c82a1",
      title: "Wedding ceremony",
      startsAt: "2027-02-14T10:30:00+05:30",
      venue: {
        name: "The Garden Courtyard",
        address: "12 Residency Road, Bengaluru, Karnataka",
        mapsUrl: "https://maps.google.com/?q=Residency+Road+Bengaluru",
      },
      dressCode: "Festive traditional attire",
    },
  ],
} satisfies Invitation;

export const multiEventInvitation = {
  couple: { partnerOne: "Mira Shah", partnerTwo: "Kabir Rao" },
  welcomeNote:
    "Join our families for two days of laughter, music, and celebration.",
  hosts: ["Nisha and Amit Shah", "Leela and Vikram Rao"],
  timeZone: "Asia/Kolkata",
  events: [
    {
      id: "evt_19f5bd",
      title: "Mehendi lunch",
      startsAt: "2027-11-19T12:00:00+05:30",
      venue: {
        name: "Saffron House",
        address: "8 Palace Road, Jaipur, Rajasthan",
        mapsUrl: "https://maps.google.com/?q=Palace+Road+Jaipur",
      },
      dressCode: "Bright colors",
    },
    {
      id: "evt_8d41ce",
      title: "Sangeet",
      startsAt: "2027-11-19T19:00:00+05:30",
      venue: {
        name: "Saffron House Lawn",
        address: "8 Palace Road, Jaipur, Rajasthan",
        mapsUrl: "https://maps.google.com/?q=Palace+Road+Jaipur",
      },
    },
    {
      id: "evt_3a97f0",
      title: "Wedding ceremony",
      startsAt: "2027-11-20T09:00:00+05:30",
      venue: {
        name: "Amber Garden Pavilion",
        address: "4 Amer Road, Jaipur, Rajasthan",
        mapsUrl: "https://maps.google.com/?q=Amer+Road+Jaipur",
      },
      dressCode: "Traditional festive attire",
    },
  ],
} satisfies Invitation;

export const demoInvitations: Invitation[] = [
  singleEventInvitation,
  multiEventInvitation,
];

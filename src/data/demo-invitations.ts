import type { Invitation } from "@/types/invitation";

export const singleEventInvitation = {
  couple: { partnerOne: "Aanya Mehta", partnerTwo: "Rohan Iyer" },
  welcomeNote:
    "With full hearts, we invite you to celebrate the beginning of our life together.",
  hosts: ["Anita and Dev Mehta", "Lakshmi and Suresh Iyer"],
  coverImage: "https://images.example.com/aanya-rohan-cover.jpg",
  events: [
    {
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
  coverImage: "https://images.example.com/mira-kabir-cover.jpg",
  events: [
    {
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
      title: "Sangeet",
      startsAt: "2027-11-19T19:00:00+05:30",
      venue: {
        name: "Saffron House Lawn",
        address: "8 Palace Road, Jaipur, Rajasthan",
        mapsUrl: "https://maps.google.com/?q=Palace+Road+Jaipur",
      },
    },
    {
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

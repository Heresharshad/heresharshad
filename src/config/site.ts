export type NavLink = { label: string; href: string };

export type SocialLink = {
  id: "instagram" | "github" | "linkedin";
  label: string;
  /** Profile URL. Leave `null` until it is known; the UI hides unset links. */
  url: string | null;
};

export const site = {
  name: "Harshad",
  handle: "Heresharshad",
  brand: "Here's Harshad",
  domain: "heresharshad.com",
  url: "https://heresharshad.com",
  email: "hello.heresharshad@gmail.com",
  role: "Product Engineer at Classavo",
  location: "Mumbai, India",
  /** Shown as a drafting annotation. */
  coordinates: "19.0760° N  72.8777° E",
  quote: "The difference between good and great is only 2°.",
  description:
    "Harshad's portfolio, projects and experiments are being built at heresharshad.com.",
} as const;

export const navLinks: NavLink[] = [
  { label: "Work", href: "/work" },
  { label: "Experiments", href: "/experiments" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const socials: SocialLink[] = [
  { id: "instagram", label: "Instagram", url: "https://www.instagram.com/heresharshad/" },
  { id: "github", label: "GitHub", url: "https://github.com/Heresharshad" },
  { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/heresharshad/" },
];

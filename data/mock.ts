export type Banner = {
  id: string;
  heading: string;
  copy: string;
  cta: string;
  gradient: string;
};

export const trendingTopics = [
  { title: "React & Next.js", meta: "1,240 Projects • 850 Open" },
  { title: "Frontend Development", meta: "982 Projects • 430 Open" },
  { title: "Backend & Node.js", meta: "753 Projects • 320 Open" },
  { title: "UI/UX Design", meta: "645 Projects • 215 Open" },
  { title: "Python & Data Science", meta: "412 Projects • 180 Open" }
];

export const categories = [
  "Projects",
  "People",
  "Web developers",
  "Content creators",
  "AI developers",
  "Motion designers",
  "Brand strategists",
  "No-code experts"
];

export const banners: Banner[] = [
  {
    id: "b1",
    heading: "Introducing JobPrepped Payments",
    copy: "The next frontier of independent work. Faster invoices, instant payouts.",
    cta: "Explore payments",
    gradient: "bg-[linear-gradient(120deg,#9A6BFF_0%,#FF4FD8_50%,#23E7FF_100%)]"
  },
  {
    id: "b2",
    heading: "Framer Hire experts",
    copy: "Partner with conversion-focused Framer independents this quarter.",
    cta: "Find Framer talent",
    gradient: "bg-[linear-gradient(120deg,#23E7FF_0%,#9A6BFF_45%,#FF4FD8_100%)]"
  }
];

export function Footer() {
  const columns = [
    {
      title: "For independents",
      links: ["Find projects", "Build portfolio", "JobPrepped Payments", "Community"]
    },
    {
      title: "For companies",
      links: ["Hire freelancers", "Manage projects", "Enterprise", "Talent networks"]
    },
    {
      title: "Use Cases",
      links: ["Framer websites", "UGC campaigns", "AI product launch", "Brand systems"]
    },
    {
      title: "Resources",
      links: ["Creative Human Data", "HCB-2026", "Blog", "Help center"]
    },
    {
      title: "Hire Freelancers",
      links: ["Web developers", "Content creators", "AI developers", "Motion designers"]
    }
  ];

  return (
    <footer className="border-t border-white/10 bg-black/30">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:grid-cols-2 lg:grid-cols-5 md:px-6">
        {columns.map((column) => (
          <section key={column.title}>
            <h3 className="text-sm font-bold text-white">{column.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/60">
              {column.links.map((link) => (
                <li key={link}>
                  <a href="#" className="transition hover:text-white">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/10 px-4 py-5 text-xs text-white/50 md:flex-row md:items-center md:justify-between md:px-6">
        <p>© 2026 JobPrepped Inc</p>
        <div className="flex gap-4">
          <a href="#">X</a>
          <a href="#">Instagram</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
}

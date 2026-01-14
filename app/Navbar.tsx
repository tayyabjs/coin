// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { name: "Home", href: "/" },
    { name: "DEX", href: "/dex" },
    { name: "Future", href: "/future" },
  ];

  return (
    <nav className="flex gap-6 p-4 bg-gray-100 border-b">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`font-medium ${
            pathname === link.href
              ? "text-blue-600 underline"
              : "text-gray-700 hover:text-gray-900"
          }`}
        >
          {link.name}
        </Link>
      ))}
    </nav>
  );
}
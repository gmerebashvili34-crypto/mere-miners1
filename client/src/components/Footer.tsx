import React from "react";

export const Footer: React.FC = () => (
  <footer className="w-full py-6 mt-12 border-t border-border bg-card/80 text-center text-sm text-muted-foreground relative z-50">
    <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
      <span>&copy; {new Date().getFullYear()} MereMiners</span>
      <span className="hidden sm:inline">|</span>
      <a href="/faq.html" target="_blank" rel="noopener noreferrer" className="hover:underline">FAQ</a>
      <span className="hidden sm:inline">|</span>
      <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:underline">Privacy Policy</a>
      <span className="hidden sm:inline">|</span>
      <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="hover:underline">Terms of Service</a>
    </div>
  </footer>
);

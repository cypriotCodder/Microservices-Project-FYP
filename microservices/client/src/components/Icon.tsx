import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 16, className = "" }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className
  };

  switch (name) {
    case "logo": return (
      <svg {...common} viewBox="0 0 24 24"><path d="M4 8h16l-1.4 9.2A2 2 0 0 1 16.6 19H7.4a2 2 0 0 1-2-1.8L4 8Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /><circle cx="9.5" cy="12.5" r=".8" fill="currentColor" stroke="none" /><circle cx="14.5" cy="12.5" r=".8" fill="currentColor" stroke="none" /></svg>
    );
    case "gear": return (
      <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
    );
    case "chevron": return (<svg {...common}><path d="m6 9 6 6 6-6" /></svg>);
    case "right": return (<svg {...common}><path d="m9 6 6 6-6 6" /></svg>);
    case "bag": return (<svg {...common}><path d="M6 7h12l-1 12a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 7Z" /><path d="M9 7V5a3 3 0 1 1 6 0v2" /></svg>);
    case "search": return (<svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
    case "plus": return (<svg {...common}><path d="M12 5v14M5 12h14" /></svg>);
    case "check": return (<svg {...common}><path d="M5 12.5 9.5 17 19 7" /></svg>);
    case "x": return (<svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>);
    case "minus": return (<svg {...common}><path d="M5 12h14" /></svg>);
    case "arrow": return (<svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
    case "spark": return (<svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>);
    case "instagram": return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" stroke="none" /></svg>);
    case "twitter": return (<svg {...common}><path d="M4 4h4l5 7 5-7h2l-6.5 9L21 20h-4l-5.2-7.3L6 20H4l7-9.6L4 4Z" fill="currentColor" stroke="none" /></svg>);
    case "youtube": return (<svg {...common}><rect x="2.5" y="6" width="19" height="12" rx="3" /><path d="m11 9.5 4 2.5-4 2.5v-5Z" fill="currentColor" stroke="none" /></svg>);
    case "github": return (<svg {...common}><path d="M12 3a9 9 0 0 0-2.85 17.55c.45.08.62-.2.62-.43v-1.5c-2.5.55-3.03-1.2-3.03-1.2-.42-1.05-1.02-1.33-1.02-1.33-.83-.57.06-.56.06-.56.92.07 1.4.95 1.4.95.82 1.4 2.15 1 2.68.77.08-.6.32-1 .58-1.24-2-.23-4.1-1-4.1-4.45 0-.98.35-1.78.92-2.4-.1-.23-.4-1.15.08-2.4 0 0 .76-.24 2.5.92a8.6 8.6 0 0 1 4.55 0c1.74-1.16 2.5-.92 2.5-.92.5 1.25.18 2.17.09 2.4.57.62.92 1.42.92 2.4 0 3.46-2.1 4.22-4.1 4.45.32.28.6.84.6 1.7v2.52c0 .24.17.52.63.43A9 9 0 0 0 12 3Z" /></svg>);
    default: return null;
  }
};

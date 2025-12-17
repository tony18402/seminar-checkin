export default function AttendeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <style>{`
          nav, .navbar, #navbar, [data-navbar] {
            display: none !important;
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

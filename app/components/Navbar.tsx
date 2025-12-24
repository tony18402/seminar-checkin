// app/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import './Navbar.css';

const navLinks = [
  { href: '/', label: 'หน้าแรก', icon: '🏠' },
  { href: '/admin', label: 'จัดการผู้เข้างาน', icon: '👥' },
  { href: '/Dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/namecards', label: 'Namecard', icon: '🏷️' },
  { href: '/registeruser', label: 'ลงทะเบียน', icon: '✍️' },
  { href: '/admin/hotel-summary', label: 'ตัวสรุปยอด', icon: '🧾' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!url || !anon) return null;
    return createClient(url, anon);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check initial session
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      
      if (session?.user) {
        setIsLoggedIn(true);
        setUserName(session.user.email?.split('@')[0] || 'User');
      } else {
        setIsLoggedIn(false);
        setUserName(null);
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setIsLoggedIn(true);
          setUserName(session.user.email?.split('@')[0] || 'User');
        } else {
          setIsLoggedIn(false);
          setUserName(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    
    // ลบ cookie
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    
    router.push('/login');
    router.refresh();
  };

  // ตรวจสอบว่าลิงก์ไหน active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <div className="navbar__brand">
          <Link href="/">
            <span className="navbar__logo">📝 Seminar Check-in</span>
          </Link>
        </div>

        <ul className="navbar__menu">
          {navLinks.map((link) => (
            <li key={link.href} className="navbar__item">
              <Link
                href={link.href}
                className={`navbar__link ${isActive(link.href) ? 'navbar__link--active' : ''}`}
              >
                <span className="navbar__link-icon">{link.icon}</span>
                <span className="navbar__link-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="navbar__auth">
          {!loading && (
            <>
              {isLoggedIn ? (
                <div className="navbar__user">
                  <span className="navbar__username">👤 {userName}</span>
                  <Link href="/profile" className="navbar__profile-btn" style={{ marginRight: '10px', padding: '8px 16px', background: '#667eea', color: 'white', borderRadius: '6px', textDecoration: 'none' }}>
                    โปรไฟล์
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="navbar__logout-btn"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              ) : (
                <Link href="/login" className="navbar__login-btn">
                  🔐 เข้าสู่ระบบ
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

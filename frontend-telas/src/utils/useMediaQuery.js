import { useEffect, useState } from 'react';

// Breakpoints do projeto (06-responsividade)
export const TABLET = '(max-width: 1024px)';
export const CELULAR = '(max-width: 600px)';

/** true enquanto a media query bater. Ex.: const ehCelular = useMediaQuery(CELULAR) */
export default function useMediaQuery(query) {
  const [bate, setBate] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const aoMudar = () => setBate(mql.matches);
    aoMudar();
    mql.addEventListener('change', aoMudar);
    window.addEventListener('resize', aoMudar); // reforço: alguns emuladores não disparam "change"
    return () => {
      mql.removeEventListener('change', aoMudar);
      window.removeEventListener('resize', aoMudar);
    };
  }, [query]);

  return bate;
}

import { useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthProviderContext } from './auth/AuthProvider';
import { createDevAuthProvider } from './auth/DevAuthProvider';
import { createOidcAuthProvider } from './auth/OidcAuthProvider';
import { AuthCallbackPage } from './routes/AuthCallbackPage';
import { CharacterSheetPage } from './routes/CharacterSheetPage';
import { CharacterWizardPage } from './routes/CharacterWizardPage';
import { GMInboxPage } from './routes/GMInboxPage';
import { HomePage } from './routes/HomePage';
import { LoginPage } from './routes/LoginPage';
import { PlayerInboxPage } from './routes/PlayerInboxPage';

export default function App() {
  const authProvider = useMemo(() => {
    const mode = import.meta.env.VITE_AUTH_MODE;
    return mode === 'oidc' ? createOidcAuthProvider() : createDevAuthProvider();
  }, []);

  return (
    <AuthProviderContext.Provider value={authProvider}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/games/:gameId/character/new" element={<CharacterWizardPage />} />
            <Route path="/me/inbox" element={<PlayerInboxPage />} />
            <Route path="/games/:gameId/characters/:characterId" element={<CharacterSheetPage />} />
            <Route path="/gm/:gameId/inbox" element={<GMInboxPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProviderContext.Provider>
  );
}

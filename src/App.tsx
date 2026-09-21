import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { CallProvider } from './features/calls/CallContext';
import { GroupCallProvider } from './features/calls/GroupCallContext';
import { CallOverlay } from './components/CallOverlay';
import { GroupCallOverlay } from './components/GroupCallOverlay';
import { IncomingGroupCallBanner } from './components/IncomingGroupCallBanner';
import { TabLockGate } from './components/TabLockGate';
import { ThemeProvider } from './lib/ThemeContext';
import { AccountPage } from './pages/Account';
import { CallsPage } from './pages/Calls';
import { ChangeIdentifierPage } from './pages/ChangeIdentifier';
import { ConversationListPage } from './pages/ConversationList';
import { DevicesPage } from './pages/Devices';
import { InvitePage } from './pages/Invite';
import { PermissionsPage } from './pages/Permissions';
import { NewChatPage } from './pages/NewChat';
import { PrivacyPage } from './pages/Privacy';
import { SettingsPage } from './pages/Settings';
import { SignInPage } from './pages/SignIn';
import { StatusPage } from './pages/Status';
import { TermsPage } from './pages/Terms';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  if (!userId) return <Navigate to="/" replace />;
  // Single-active-tab enforcement only matters once there's a live session
  // (a real WebSocket connection, unread badges, etc.) to protect — gating
  // pre-auth or the public /terms /privacy /invite pages would be pointless.
  return <TabLockGate>{children}</TabLockGate>;
}

function RootRoute() {
  const { userId } = useAuth();
  return userId ? <Navigate to="/chats" replace /> : <SignInPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/invite" element={<InvitePage />} />
      <Route path="/permissions" element={<PermissionsPage />} />
      <Route
        path="/chats/new"
        element={
          <RequireAuth>
            <NewChatPage />
          </RequireAuth>
        }
      />
      <Route
        path="/chats/:conversationId?"
        element={
          <RequireAuth>
            <ConversationListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/status"
        element={
          <RequireAuth>
            <StatusPage />
          </RequireAuth>
        }
      />
      <Route
        path="/calls"
        element={
          <RequireAuth>
            <CallsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/account"
        element={
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/change-identifier"
        element={
          <RequireAuth>
            <ChangeIdentifierPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/devices"
        element={
          <RequireAuth>
            <DevicesPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
          <GroupCallProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            {/* App-root, not a route — survives navigation, same as mobile's _layout.tsx mounting. */}
            <IncomingGroupCallBanner />
            <GroupCallOverlay />
            <CallOverlay />
          </GroupCallProvider>
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

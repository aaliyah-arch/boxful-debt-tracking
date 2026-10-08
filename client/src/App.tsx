import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { BusinessUnit } from './types';
import { Navbar } from './components/Navbar';
import { ReportUploadModal } from './components/ReportUploadModal';
import { DashboardPage } from './pages/DashboardPage';
import { CaseListPage } from './pages/CaseListPage';
import { LoginPage } from './pages/LoginPage';

import { standaloneStore, DEFAULT_GAS_URL } from './api/standaloneStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit>('VALET');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases'>('dashboard');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [caseFilterPreset, setCaseFilterPreset] = useState<{ stage?: string; monthBucket?: string }>({});

  React.useEffect(() => {
    // 1. Silent sync immediately on app launch
    standaloneStore.syncFromGoogleAppsScript(DEFAULT_GAS_URL)
      .then(() => queryClient.invalidateQueries({ queryKey: ['whitelist'] }))
      .catch((e) => console.log('[AutoSync] Startup sync skipped:', e.message));

    // 2. Periodic sync every 60 seconds in the background
    const interval = setInterval(() => {
      standaloneStore.syncFromGoogleAppsScript(DEFAULT_GAS_URL)
        .then(() => queryClient.invalidateQueries({ queryKey: ['whitelist'] }))
        .catch((e) => console.log('[AutoSync] Interval sync skipped:', e.message));
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          系統載入中
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleNavigateToCasesFromDashboard = (filters?: { stage?: string; monthBucket?: string }) => {
    if (filters) {
      setCaseFilterPreset(filters);
    } else {
      setCaseFilterPreset({});
    }
    setActiveTab('cases');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar */}
      <Navbar
        currentBusinessUnit={businessUnit}
        onBusinessUnitChange={(unit) => setBusinessUnit(unit)}
        onOpenUpload={() => setIsUploadOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardPage
            businessUnit={businessUnit}
            onSelectBusinessUnit={(unit) => setBusinessUnit(unit)}
            onNavigateToCases={handleNavigateToCasesFromDashboard}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        )}

        {activeTab === 'cases' && (
          <CaseListPage
            businessUnit={businessUnit}
            onSelectBusinessUnit={(unit) => setBusinessUnit(unit)}
            initialStage={caseFilterPreset.stage}
            initialMonthBucket={caseFilterPreset.monthBucket}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        )}
      </main>

      {/* Outstanding Report Upload Modal */}
      <ReportUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        defaultBusinessUnit={businessUnit}
        onUploadSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
          queryClient.invalidateQueries({ queryKey: ['cases-list'] });
        }}
      />
    </div>
  );
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

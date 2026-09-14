import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { BusinessUnit } from './types';
import { Navbar } from './components/Navbar';
import { ReportUploadModal } from './components/ReportUploadModal';
import { DashboardPage } from './pages/DashboardPage';
import { CaseListPage } from './pages/CaseListPage';
import { WhitelistPage } from './pages/WhitelistPage';
import { LoginPage } from './pages/LoginPage';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases' | 'whitelist'>('dashboard');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [caseFilterPreset, setCaseFilterPreset] = useState<{ stage?: string; monthBucket?: string }>({});

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-slate-300">系統載入中...</p>
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation Bar */}
      <Navbar
        currentBusinessUnit={businessUnit}
        onBusinessUnitChange={(unit) => setBusinessUnit(unit)}
        onOpenUpload={() => setIsUploadOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {activeTab === 'whitelist' && <WhitelistPage />}
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

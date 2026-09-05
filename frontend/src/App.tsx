import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/appStore';
import { initTheme } from './lib/theme';
import { initRealtimeSync } from './lib/realtimeSync';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import DashboardPage from './pages/DashboardPage';
import DailyEntryPage from './pages/DailyEntryPage';
import CustomersPage from './pages/CustomersPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import AddCustomerPage from './pages/AddCustomerPage';
import MonthlyBillsPage from './pages/MonthlyBillsPage';
import SettingsPage from './pages/SettingsPage';
import CattlePage from './pages/CattlePage';
import AddAnimalPage from './pages/AddAnimalPage';
import AnimalProfilePage from './pages/AnimalProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  const { loadCustomers, loadSettings } = useAppStore();
  const [showSplash, setShowSplash] = useState(true);

  // Initialize theme, realtime sync, and initial store data
  useEffect(() => {
    initTheme();
    initRealtimeSync();
    loadCustomers();
    loadSettings();

    // Global listener: when another device modifies customers or settings, auto-reload store
    const handleCustomerChange = () => {
      loadCustomers();
    };
    const handleSettingsChange = () => {
      loadSettings();
    };

    window.addEventListener('azhagi_rt_customers', handleCustomerChange);
    window.addEventListener('azhagi_rt_app_settings', handleSettingsChange);

    return () => {
      window.removeEventListener('azhagi_rt_customers', handleCustomerChange);
      window.removeEventListener('azhagi_rt_app_settings', handleSettingsChange);
    };
  }, [loadCustomers, loadSettings]);

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2500,
            style: { borderRadius: '10px', fontWeight: 500 },
          }}
        />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/daily-entry" element={<DailyEntryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/add" element={<AddCustomerPage />} />
            <Route path="/customers/:id" element={<CustomerProfilePage />} />
            <Route path="/customers/:id/edit" element={<AddCustomerPage />} />
            <Route path="/bills" element={<MonthlyBillsPage />} />
            <Route path="/bills/statement" element={<Navigate to="/bills?tab=overall" replace />} />
            <Route path="/cattle" element={<CattlePage />} />
            <Route path="/cattle/add" element={<AddAnimalPage />} />
            <Route path="/cattle/:id" element={<AnimalProfilePage />} />
            <Route path="/cattle/:id/edit" element={<AddAnimalPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

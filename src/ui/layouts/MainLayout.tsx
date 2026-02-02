import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Search, Menu } from 'lucide-react';
import './Layout.css';

import { useAuth } from '../../logic/authContext';

interface TopbarProps {
    onMenuToggle: () => void;
}

function Topbar({ onMenuToggle }: TopbarProps) {
    const { user, isAdmin } = useAuth();
    return (
        <header className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <button className="mobile-menu-toggle" onClick={onMenuToggle} aria-label="Abrir menú">
                    <Menu size={24} />
                </button>
                <div className="search-bar">
                    <Search size={18} color="var(--color-text-secondary)" />
                    <input type="text" placeholder="Buscar..." />
                </div>
            </div>

            <div className="topbar-actions">
                <button className="icon-btn">
                    <Bell size={20} />
                    <span className="notification-dot"></span>
                </button>
                <div className="user-profile">
                    <div className="avatar">{user?.nombre?.[0] || 'U'}</div>
                    <div className="user-info">
                        <span className="name">{user?.nombre || 'Usuario'}</span>
                        <span className="role">{isAdmin ? 'Administrador' : 'Colaborador'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

export function MainLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="main-layout">
            {/* Overlay for mobile */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
                onClick={closeSidebar}
            />

            <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

            <div className="content-wrapper">
                <Topbar onMenuToggle={toggleSidebar} />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

